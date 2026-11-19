package vulpesFunctions

import (
	"hash"
	"bytes"
	"strings"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/sha512"
	"encoding/json"
	"encoding/base64"
	"docker-manager-go/src/appErrors"
	vulpesDtos "docker-manager-go/src/vulpes/dtos"
)

var jwtHashes = map[string]func() hash.Hash{
	"HS256": sha256.New,
	"HS384": sha512.New384,
	"HS512": sha512.New,
}

func SignJwt(auth vulpesDtos.AuthDto) (string, error) {
	newHash, supported := jwtHashes[auth.Algorithm]
	if !supported {
		return "", appErrors.New("vulpes.jwtUnsupportedAlgorithm", "algoritmo JWT não suportado: {algorithm}").With("algorithm", auth.Algorithm)
	}
	if auth.Secret == "" {
		return "", appErrors.New("vulpes.jwtSecretRequired", "informe o segredo usado para assinar o JWT")
	}

	payload := strings.TrimSpace(auth.Payload)
	if payload == "" {
		payload = "{}"
	}
	var claims map[string]json.RawMessage
	if err := json.Unmarshal([]byte(payload), &claims); err != nil {
		return "", appErrors.Wrap("vulpes.invalidJwtPayload", "o payload do JWT precisa ser um objeto JSON válido", err)
	}
	var compactPayload bytes.Buffer
	if err := json.Compact(&compactPayload, []byte(payload)); err != nil {
		return "", appErrors.Wrap("vulpes.invalidJwtPayload", "o payload do JWT precisa ser um objeto JSON válido", err)
	}

	encoding := base64.RawURLEncoding
	header := `{"alg":"` + auth.Algorithm + `","typ":"JWT"}`
	signingInput := encoding.EncodeToString([]byte(header)) + "." + encoding.EncodeToString(compactPayload.Bytes())
	signer := hmac.New(newHash, []byte(auth.Secret))
	signer.Write([]byte(signingInput))
	return signingInput + "." + encoding.EncodeToString(signer.Sum(nil)), nil
}
