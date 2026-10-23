package vulpesFunctions

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	vulpesDtos "docker-manager-go/src/vulpes/dtos"
)

const DefaultUserAgent = "Vulpes/1.0"

var methodPattern = regexp.MustCompile("^[A-Z0-9!#$%&'*+.^_`|~-]+$")

var quoteEscaper = strings.NewReplacer("\\", "\\\\", `"`, "\\\"")

var rawLanguageContentTypes = map[string]string{
	"xml":        "application/xml",
	"text":       "text/plain",
	"html":       "text/html",
	"json":       "application/json",
	"javascript": "application/javascript",
}

type preparedBody struct {
	reader      io.Reader
	length      int64
	reopen      func() (io.ReadCloser, error)
	contentType string
}

func BuildHttpRequest(ctx context.Context, httpRequest vulpesDtos.HttpRequestDto, auth vulpesDtos.AuthDto) (*http.Request, error) {
	method := strings.ToUpper(strings.TrimSpace(httpRequest.Method))
	if !methodPattern.MatchString(method) {
		return nil, fmt.Errorf("método HTTP inválido: %q", httpRequest.Method)
	}

	targetUrl, err := NormalizeUrl(ApplyPathVariables(httpRequest.Url, httpRequest.PathVariables), "http")
	if err != nil {
		return nil, err
	}
	if scheme := strings.ToLower(targetUrl[:strings.Index(targetUrl, "://")]); scheme != "http" && scheme != "https" {
		return nil, fmt.Errorf("protocolo %q não suportado em requisições HTTP", scheme)
	}
	authEntries := BuildAuthEntries(auth)
	targetUrl = AppendQuery(targetUrl, authEntries.Query)

	body, err := buildBody(httpRequest.Body)
	if err != nil {
		return nil, err
	}

	request, err := http.NewRequestWithContext(ctx, method, targetUrl, body.reader)
	if err != nil {
		if closer, ok := body.reader.(io.Closer); ok {
			closer.Close()
		}
		return nil, fmt.Errorf("não foi possível montar a requisição: %w", err)
	}
	if body.reopen != nil {
		request.ContentLength = body.length
		request.GetBody = body.reopen
	}

	for _, header := range httpRequest.Headers {
		key := strings.TrimSpace(header.Key)
		if !header.Enabled || key == "" {
			continue
		}
		if strings.EqualFold(key, "Host") {
			request.Host = header.Value
			continue
		}
		request.Header.Add(key, header.Value)
	}

	setHeaderIfMissing(request.Header, "Content-Type", body.contentType)
	for _, entry := range authEntries.Headers {
		setHeaderIfMissing(request.Header, entry.Key, entry.Value)
	}
	setHeaderIfMissing(request.Header, "Accept", "*/*")
	setHeaderIfMissing(request.Header, "User-Agent", DefaultUserAgent)
	return request, nil
}

func setHeaderIfMissing(headers http.Header, key string, value string) {
	if value != "" && headers.Get(key) == "" {
		headers.Set(key, value)
	}
}

func buildBody(body vulpesDtos.HttpBodyDto) (preparedBody, error) {
	switch body.Mode {
	case vulpesDtos.BodyRaw:
		contentType := rawLanguageContentTypes[body.Language]
		if contentType == "" {
			contentType = "text/plain"
		}
		return preparedBody{reader: strings.NewReader(body.Raw), contentType: contentType}, nil
	case vulpesDtos.BodyUrlEncoded:
		return preparedBody{reader: strings.NewReader(encodeUrlEncoded(body.UrlEncoded)), contentType: "application/x-www-form-urlencoded"}, nil
	case vulpesDtos.BodyFormData:
		return buildMultipartBody(body.FormData)
	case vulpesDtos.BodyBinary:
		return buildBinaryBody(body.BinaryPath)
	case vulpesDtos.BodyGraphql:
		return buildGraphqlBody(body.GraphqlQuery, body.GraphqlVariables)
	}
	return preparedBody{}, nil
}

func encodeUrlEncoded(fields []vulpesDtos.KeyValueDto) string {
	pairs := make([]string, 0, len(fields))
	for _, field := range fields {
		if field.Enabled && field.Key != "" {
			pairs = append(pairs, url.QueryEscape(field.Key)+"="+url.QueryEscape(field.Value))
		}
	}
	return strings.Join(pairs, "&")
}

func buildMultipartBody(fields []vulpesDtos.FormFieldDto) (preparedBody, error) {
	var buffer bytes.Buffer
	writer := multipart.NewWriter(&buffer)
	for _, field := range fields {
		if !field.Enabled || field.Key == "" {
			continue
		}
		if field.Kind == "file" {
			if err := writeFilePart(writer, field); err != nil {
				return preparedBody{}, err
			}
			continue
		}

		header := textproto.MIMEHeader{}
		header.Set("Content-Disposition", fmt.Sprintf(`form-data; name="%s"`, quoteEscaper.Replace(field.Key)))
		if field.ContentType != "" {
			header.Set("Content-Type", field.ContentType)
		}
		part, err := writer.CreatePart(header)
		if err != nil {
			return preparedBody{}, err
		}
		if _, err := io.WriteString(part, field.Value); err != nil {
			return preparedBody{}, err
		}
	}
	if err := writer.Close(); err != nil {
		return preparedBody{}, err
	}
	return preparedBody{reader: bytes.NewReader(buffer.Bytes()), contentType: writer.FormDataContentType()}, nil
}

func writeFilePart(writer *multipart.Writer, field vulpesDtos.FormFieldDto) error {
	if strings.TrimSpace(field.FilePath) == "" {
		return fmt.Errorf("selecione o arquivo do campo %q", field.Key)
	}
	file, err := os.Open(field.FilePath)
	if err != nil {
		return fmt.Errorf("não foi possível abrir o arquivo do campo %q: %w", field.Key, err)
	}
	defer file.Close()

	contentType := field.ContentType
	if contentType == "" {
		contentType = contentTypeByExtension(field.FilePath)
	}
	header := textproto.MIMEHeader{}
	header.Set("Content-Type", contentType)
	header.Set("Content-Disposition", fmt.Sprintf(
		`form-data; name="%s"; filename="%s"`,
		quoteEscaper.Replace(field.Key),
		quoteEscaper.Replace(filepath.Base(field.FilePath)),
	))
	part, err := writer.CreatePart(header)
	if err != nil {
		return err
	}
	_, err = io.Copy(part, file)
	return err
}

func buildBinaryBody(path string) (preparedBody, error) {
	if strings.TrimSpace(path) == "" {
		return preparedBody{}, errors.New("selecione o arquivo do corpo binário")
	}
	file, err := os.Open(path)
	if err != nil {
		return preparedBody{}, fmt.Errorf("não foi possível abrir o arquivo do corpo: %w", err)
	}
	info, err := file.Stat()
	if err != nil {
		file.Close()
		return preparedBody{}, err
	}
	return preparedBody{
		reader:      file,
		length:      info.Size(),
		contentType: contentTypeByExtension(path),
		reopen:      func() (io.ReadCloser, error) { return os.Open(path) },
	}, nil
}

func buildGraphqlBody(query string, variables string) (preparedBody, error) {
	payload := map[string]any{"query": query}
	if strings.TrimSpace(variables) != "" {
		var parsedVariables any
		if err := json.Unmarshal([]byte(variables), &parsedVariables); err != nil {
			return preparedBody{}, fmt.Errorf("as variáveis GraphQL não são um JSON válido: %w", err)
		}
		payload["variables"] = parsedVariables
	}
	encoded, err := json.Marshal(payload)
	if err != nil {
		return preparedBody{}, err
	}
	return preparedBody{reader: bytes.NewReader(encoded), contentType: "application/json"}, nil
}

func contentTypeByExtension(path string) string {
	if contentType := mime.TypeByExtension(filepath.Ext(path)); contentType != "" {
		return contentType
	}
	return "application/octet-stream"
}
