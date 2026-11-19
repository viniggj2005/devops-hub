package vulpesHandlers

import (
	"io"
	"sync"
	"time"
	"context"
	"net/http"
	vulpesDtos "docker-manager-go/src/vulpes/dtos"
	vulpesFunctions "docker-manager-go/src/vulpes/functions"
)

const (
	oauth2RequestTimeout = 30 * time.Second
	oauth2ExpiryMargin   = 30 * time.Second
)

type cachedAccessToken struct {
	expiresAt   time.Time
	accessToken string
}

type oauth2TokenCache struct {
	mutex  sync.Mutex
	tokens map[string]cachedAccessToken
}

func newOAuth2TokenCache() *oauth2TokenCache {
	return &oauth2TokenCache{tokens: map[string]cachedAccessToken{}}
}

func (cache *oauth2TokenCache) find(key string, now time.Time) (string, bool) {
	cache.mutex.Lock()
	defer cache.mutex.Unlock()
	cached, found := cache.tokens[key]
	if !found || !now.Before(cached.expiresAt) {
		delete(cache.tokens, key)
		return "", false
	}
	return cached.accessToken, true
}

func (cache *oauth2TokenCache) store(key string, token vulpesFunctions.OAuth2Token, now time.Time) {
	if token.ExpiresIn <= oauth2ExpiryMargin {
		return
	}
	cache.mutex.Lock()
	defer cache.mutex.Unlock()
	cache.tokens[key] = cachedAccessToken{accessToken: token.AccessToken, expiresAt: now.Add(token.ExpiresIn - oauth2ExpiryMargin)}
}

func (handlerStruct *VulpesClientHandlerStruct) materializeAuth(callContext context.Context, auth vulpesDtos.AuthDto) (vulpesDtos.AuthDto, error) {
	switch auth.Type {
	case vulpesDtos.AuthJwt:
		token, err := vulpesFunctions.SignJwt(auth)
		if err != nil {
			return auth, err
		}
		return vulpesDtos.AuthDto{Type: vulpesDtos.AuthBearer, Token: token}, nil
	case vulpesDtos.AuthOAuth2:
		token, err := handlerStruct.oauth2AccessToken(callContext, auth)
		if err != nil {
			return auth, err
		}
		return vulpesDtos.AuthDto{Type: vulpesDtos.AuthBearer, Token: token}, nil
	}
	return auth, nil
}

func (handlerStruct *VulpesClientHandlerStruct) oauth2AccessToken(callContext context.Context, auth vulpesDtos.AuthDto) (string, error) {
	cacheKey := vulpesFunctions.OAuth2CacheKey(auth)
	if accessToken, found := handlerStruct.oauth2Tokens.find(cacheKey, time.Now()); found {
		return accessToken, nil
	}
	client := &http.Client{Transport: handlerStruct.httpTransports.secure, Timeout: oauth2RequestTimeout}
	token, err := vulpesFunctions.RequestOAuth2Token(callContext, client, auth)
	if err != nil {
		return "", err
	}
	handlerStruct.oauth2Tokens.store(cacheKey, token, time.Now())
	return token.AccessToken, nil
}

type digestTransport struct {
	base     http.RoundTripper
	username string
	password string
}

func (transport digestTransport) RoundTrip(request *http.Request) (*http.Response, error) {
	response, err := transport.base.RoundTrip(request)
	if err != nil || response.StatusCode != http.StatusUnauthorized {
		return response, err
	}
	challenge, found := vulpesFunctions.FindDigestChallenge(response.Header.Values("WWW-Authenticate"))
	if !found || (request.Body != nil && request.Body != http.NoBody && request.GetBody == nil) {
		return response, nil
	}
	authorization, err := vulpesFunctions.DigestAuthorization(challenge, request.Method, request.URL.RequestURI(), transport.username, transport.password, vulpesFunctions.NewDigestClientNonce())
	if err != nil {
		response.Body.Close()
		return nil, err
	}

	retry := request.Clone(request.Context())
	if request.GetBody != nil {
		body, err := request.GetBody()
		if err != nil {
			return response, nil
		}
		retry.Body = body
	}
	retry.Header.Set("Authorization", authorization)
	io.Copy(io.Discard, io.LimitReader(response.Body, 64<<10))
	response.Body.Close()
	return transport.base.RoundTrip(retry)
}
