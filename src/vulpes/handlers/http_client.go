package vulpesHandlers

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"net/http/httptrace"
	"net/url"
	"sort"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	vulpesDtos "docker-manager-go/src/vulpes/dtos"
	vulpesFunctions "docker-manager-go/src/vulpes/functions"
)

const (
	maxRedirects         = 10
	maxResponseBodyBytes = 64 << 20
)

var textualContentTypes = []string{"json", "xml", "html", "javascript", "ecmascript", "yaml", "csv", "graphql", "x-www-form-urlencoded", "svg"}

type requestTimings struct {
	mutex        sync.Mutex
	dnsDone      time.Time
	tlsDone      time.Time
	dnsStart     time.Time
	tlsStart     time.Time
	firstByte    time.Time
	connectDone  time.Time
	wroteRequest time.Time
	connectStart time.Time
}

func (timings *requestTimings) markFirst(target *time.Time) {
	timings.mutex.Lock()
	defer timings.mutex.Unlock()
	if target.IsZero() {
		*target = time.Now()
	}
}

func (timings *requestTimings) markLatest(target *time.Time) {
	timings.mutex.Lock()
	defer timings.mutex.Unlock()
	*target = time.Now()
}

func (timings *requestTimings) trace() *httptrace.ClientTrace {
	return &httptrace.ClientTrace{
		DNSStart:             func(httptrace.DNSStartInfo) { timings.markFirst(&timings.dnsStart) },
		DNSDone:              func(httptrace.DNSDoneInfo) { timings.markFirst(&timings.dnsDone) },
		ConnectStart:         func(string, string) { timings.markFirst(&timings.connectStart) },
		ConnectDone:          func(string, string, error) { timings.markFirst(&timings.connectDone) },
		TLSHandshakeStart:    func() { timings.markFirst(&timings.tlsStart) },
		TLSHandshakeDone:     func(tls.ConnectionState, error) { timings.markFirst(&timings.tlsDone) },
		WroteRequest:         func(httptrace.WroteRequestInfo) { timings.markLatest(&timings.wroteRequest) },
		GotFirstResponseByte: func() { timings.markLatest(&timings.firstByte) },
	}
}

func (timings *requestTimings) summary(started time.Time, finished time.Time) vulpesDtos.TimingsDto {
	timings.mutex.Lock()
	defer timings.mutex.Unlock()
	return vulpesDtos.TimingsDto{
		DnsMs:      elapsedMs(timings.dnsStart, timings.dnsDone),
		TlsMs:      elapsedMs(timings.tlsStart, timings.tlsDone),
		WaitMs:     elapsedMs(timings.wroteRequest, timings.firstByte),
		TotalMs:    elapsedMs(started, finished),
		ConnectMs:  elapsedMs(timings.connectStart, timings.connectDone),
		DownloadMs: elapsedMs(timings.firstByte, finished),
	}
}

func elapsedMs(from time.Time, to time.Time) float64 {
	if from.IsZero() || to.IsZero() || to.Before(from) {
		return 0
	}
	return float64(to.Sub(from).Microseconds()) / 1000
}

func (handlerStruct *VulpesClientHandlerStruct) httpClient(settings vulpesDtos.HttpSettingsDto) *http.Client {
	return &http.Client{
		Transport: handlerStruct.httpTransports.pick(settings.SkipTlsVerify),
		CheckRedirect: func(_ *http.Request, previous []*http.Request) error {
			if settings.DisableRedirects {
				return http.ErrUseLastResponse
			}
			if len(previous) >= maxRedirects {
				return fmt.Errorf("a requisição foi redirecionada mais de %d vezes", maxRedirects)
			}
			return nil
		},
	}
}

func (handlerStruct *VulpesClientHandlerStruct) SendHttpRequest(callContext context.Context, token string, input vulpesDtos.ExecutionInputDto) (*vulpesDtos.HttpResponseDto, error) {
	resolver, request, auth, err := handlerStruct.prepareExecution(token, input)
	if err != nil {
		return nil, err
	}
	if request.Http == nil {
		return nil, errors.New("a requisição não é HTTP")
	}
	httpRequest := resolver.ResolveHttpRequest(*request.Http)

	requestContext := callContext
	if httpRequest.Settings.TimeoutMs > 0 {
		var cancel context.CancelFunc
		requestContext, cancel = context.WithTimeout(callContext, time.Duration(httpRequest.Settings.TimeoutMs)*time.Millisecond)
		defer cancel()
	}

	timings := &requestTimings{}
	built, err := vulpesFunctions.BuildHttpRequest(httptrace.WithClientTrace(requestContext, timings.trace()), httpRequest, auth)
	if err != nil {
		return nil, err
	}

	started := time.Now()
	response, err := handlerStruct.httpClient(httpRequest.Settings).Do(built)
	if err != nil {
		return nil, describeRequestError(err, requestContext)
	}
	defer response.Body.Close()

	body, truncated, err := readLimited(response.Body, maxResponseBodyBytes)
	if err != nil {
		return nil, describeRequestError(err, requestContext)
	}
	finished := time.Now()

	contentType := response.Header.Get("Content-Type")
	result := &vulpesDtos.HttpResponseDto{
		Url:            response.Request.URL.String(),
		Status:         response.Status,
		Method:         response.Request.Method,
		Cookies:        responseCookies(response),
		Headers:        flattenHeaders(response.Header),
		Timings:        timings.summary(started, finished),
		Protocol:       response.Proto,
		SizeBytes:      int64(len(body)),
		Truncated:      truncated,
		StatusCode:     response.StatusCode,
		ContentType:    contentType,
		RequestHeaders: sentHeaders(response.Request),
	}
	if isTextual(contentType, body) {
		result.Body, result.BodyEncoding = string(body), vulpesDtos.EncodingText
	} else {
		result.Body, result.BodyEncoding = base64.StdEncoding.EncodeToString(body), vulpesDtos.EncodingBase64
	}
	return result, nil
}

func readLimited(reader io.Reader, limit int64) ([]byte, bool, error) {
	body, err := io.ReadAll(io.LimitReader(reader, limit+1))
	if err != nil {
		return nil, false, err
	}
	if int64(len(body)) > limit {
		return body[:limit], true, nil
	}
	return body, false, nil
}

func isTextual(contentType string, body []byte) bool {
	mediaType, _, err := mime.ParseMediaType(contentType)
	if err != nil || mediaType == "" {
		return utf8.Valid(body)
	}
	if strings.HasPrefix(mediaType, "text/") {
		return true
	}
	for _, marker := range textualContentTypes {
		if strings.Contains(mediaType, marker) {
			return true
		}
	}
	return false
}

func flattenHeaders(headers http.Header) []vulpesDtos.HeaderDto {
	keys := make([]string, 0, len(headers))
	for key := range headers {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	flattened := []vulpesDtos.HeaderDto{}
	for _, key := range keys {
		for _, value := range headers[key] {
			flattened = append(flattened, vulpesDtos.HeaderDto{Key: key, Value: value})
		}
	}
	return flattened
}

func sentHeaders(request *http.Request) []vulpesDtos.HeaderDto {
	headers := flattenHeaders(request.Header)
	host := request.Host
	if host == "" {
		host = request.URL.Host
	}
	return append([]vulpesDtos.HeaderDto{{Key: "Host", Value: host}}, headers...)
}

func responseCookies(response *http.Response) []vulpesDtos.CookieDto {
	sameSiteNames := map[http.SameSite]string{
		http.SameSiteLaxMode:    "Lax",
		http.SameSiteNoneMode:   "None",
		http.SameSiteStrictMode: "Strict",
	}
	cookies := []vulpesDtos.CookieDto{}
	for _, cookie := range response.Cookies() {
		expires := ""
		if !cookie.Expires.IsZero() {
			expires = cookie.Expires.UTC().Format(time.RFC1123)
		}
		cookies = append(cookies, vulpesDtos.CookieDto{
			Name:     cookie.Name,
			Path:     cookie.Path,
			Value:    cookie.Value,
			Domain:   cookie.Domain,
			Secure:   cookie.Secure,
			Expires:  expires,
			HttpOnly: cookie.HttpOnly,
			SameSite: sameSiteNames[cookie.SameSite],
		})
	}
	return cookies
}

func describeRequestError(err error, requestContext context.Context) error {
	switch {
	case errors.Is(requestContext.Err(), context.DeadlineExceeded):
		return errors.New("o tempo limite da requisição foi excedido")
	case errors.Is(err, context.Canceled):
		return errors.New("requisição cancelada")
	}

	var unknownAuthority x509.UnknownAuthorityError
	var hostnameMismatch x509.HostnameError
	var invalidCertificate x509.CertificateInvalidError
	var verificationError *tls.CertificateVerificationError
	if errors.As(err, &verificationError) || errors.As(err, &unknownAuthority) || errors.As(err, &hostnameMismatch) || errors.As(err, &invalidCertificate) {
		return fmt.Errorf("o certificado TLS do servidor não é confiável (%v); desative a verificação de certificado nas configurações da requisição para ignorar", unwrapUrlError(err))
	}
	return unwrapUrlError(err)
}

func unwrapUrlError(err error) error {
	var urlError *url.Error
	if errors.As(err, &urlError) {
		return urlError.Err
	}
	return err
}
