package vulpesFunctions

import (
	"io"
	"fmt"
	"bytes"
	"sort"
	"time"
	"strings"
	"net/url"
	"net/http"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"docker-manager-go/src/appErrors"
	vulpesDtos "docker-manager-go/src/vulpes/dtos"
)

const awsSigningAlgorithm = "AWS4-HMAC-SHA256"

func SignAwsV4(request *http.Request, auth vulpesDtos.AuthDto, now time.Time) error {
	region, service := strings.TrimSpace(auth.Region), strings.TrimSpace(auth.Service)
	accessKey, secretKey := strings.TrimSpace(auth.AccessKey), strings.TrimSpace(auth.SecretKey)
	if accessKey == "" || secretKey == "" {
		return appErrors.New("vulpes.awsCredentialsRequired", "informe o Access Key e o Secret Key da AWS")
	}
	if region == "" || service == "" {
		return appErrors.New("vulpes.awsScopeRequired", "informe a região e o serviço da AWS")
	}

	payloadHash, err := hashRequestBody(request)
	if err != nil {
		return appErrors.Wrap("vulpes.awsBodyHashFailed", "não foi possível ler o corpo para assinar a requisição AWS", err)
	}

	amazonDate := now.UTC().Format("20060102T150405Z")
	day := amazonDate[:8]
	request.Header.Set("X-Amz-Date", amazonDate)
	if service == "s3" {
		request.Header.Set("X-Amz-Content-Sha256", payloadHash)
	}
	if sessionToken := strings.TrimSpace(auth.SessionToken); sessionToken != "" {
		request.Header.Set("X-Amz-Security-Token", sessionToken)
	}

	host := request.Host
	if host == "" {
		host = request.URL.Host
	}
	signedValues := map[string]string{"host": host}
	for _, headerName := range []string{"X-Amz-Date", "X-Amz-Content-Sha256", "X-Amz-Security-Token"} {
		if value := request.Header.Get(headerName); value != "" {
			signedValues[strings.ToLower(headerName)] = value
		}
	}
	headerNames := make([]string, 0, len(signedValues))
	for headerName := range signedValues {
		headerNames = append(headerNames, headerName)
	}
	sort.Strings(headerNames)

	var canonicalHeaders strings.Builder
	for _, headerName := range headerNames {
		canonicalHeaders.WriteString(headerName + ":" + strings.TrimSpace(signedValues[headerName]) + "\n")
	}
	signedHeaders := strings.Join(headerNames, ";")
	canonicalRequest := strings.Join([]string{
		request.Method,
		awsCanonicalPath(request.URL),
		awsCanonicalQuery(request.URL),
		canonicalHeaders.String(),
		signedHeaders,
		payloadHash,
	}, "\n")

	credentialScope := strings.Join([]string{day, region, service, "aws4_request"}, "/")
	stringToSign := strings.Join([]string{awsSigningAlgorithm, amazonDate, credentialScope, sha256Hex([]byte(canonicalRequest))}, "\n")

	signingKey := hmacSha256([]byte("AWS4"+secretKey), day)
	for _, scopePart := range []string{region, service, "aws4_request"} {
		signingKey = hmacSha256(signingKey, scopePart)
	}
	signature := hex.EncodeToString(hmacSha256(signingKey, stringToSign))
	request.Header.Set("Authorization", fmt.Sprintf("%s Credential=%s/%s, SignedHeaders=%s, Signature=%s", awsSigningAlgorithm, accessKey, credentialScope, signedHeaders, signature))
	return nil
}

func hashRequestBody(request *http.Request) (string, error) {
	if request.Body == nil || request.Body == http.NoBody {
		return sha256Hex(nil), nil
	}
	if request.GetBody == nil {
		content, err := io.ReadAll(request.Body)
		if err != nil {
			return "", err
		}
		request.Body.Close()
		request.Body = io.NopCloser(bytes.NewReader(content))
		request.GetBody = func() (io.ReadCloser, error) { return io.NopCloser(bytes.NewReader(content)), nil }
		return sha256Hex(content), nil
	}
	body, err := request.GetBody()
	if err != nil {
		return "", err
	}
	defer body.Close()
	hasher := sha256.New()
	if _, err := io.Copy(hasher, body); err != nil {
		return "", err
	}
	return hex.EncodeToString(hasher.Sum(nil)), nil
}

func awsCanonicalPath(target *url.URL) string {
	if path := target.EscapedPath(); path != "" {
		return path
	}
	return "/"
}

func awsCanonicalQuery(target *url.URL) string {
	values := target.Query()
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	pairs := []string{}
	for _, key := range keys {
		entries := values[key]
		sort.Strings(entries)
		for _, entry := range entries {
			pairs = append(pairs, awsEscape(key)+"="+awsEscape(entry))
		}
	}
	return strings.Join(pairs, "&")
}

func awsEscape(text string) string {
	return strings.ReplaceAll(url.QueryEscape(text), "+", "%20")
}

func sha256Hex(content []byte) string {
	digest := sha256.Sum256(content)
	return hex.EncodeToString(digest[:])
}

func hmacSha256(key []byte, message string) []byte {
	signer := hmac.New(sha256.New, key)
	signer.Write([]byte(message))
	return signer.Sum(nil)
}
