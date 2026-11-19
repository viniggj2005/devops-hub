package vulpesFunctions

import (
	"fmt"
	"hash"
	"strings"
	"crypto/md5"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"docker-manager-go/src/appErrors"
)

var digestHashes = map[string]func() hash.Hash{
	"MD5":     md5.New,
	"SHA-256": sha256.New,
}

func FindDigestChallenge(authenticateHeaders []string) (map[string]string, bool) {
	for _, header := range authenticateHeaders {
		trimmed := strings.TrimSpace(header)
		if len(trimmed) > 7 && strings.EqualFold(trimmed[:7], "Digest ") {
			return parseChallengeParams(trimmed[7:]), true
		}
	}
	return nil, false
}

func parseChallengeParams(text string) map[string]string {
	params := map[string]string{}
	position := 0
	for position < len(text) {
		for position < len(text) && (text[position] == ' ' || text[position] == ',') {
			position++
		}
		nameStart := position
		for position < len(text) && text[position] != '=' && text[position] != ',' {
			position++
		}
		name := strings.ToLower(strings.TrimSpace(text[nameStart:position]))
		if position >= len(text) || text[position] != '=' {
			continue
		}
		position++

		var value strings.Builder
		if position < len(text) && text[position] == '"' {
			position++
			for position < len(text) && text[position] != '"' {
				if text[position] == '\\' && position+1 < len(text) {
					position++
				}
				value.WriteByte(text[position])
				position++
			}
			position++
		} else {
			for position < len(text) && text[position] != ',' {
				value.WriteByte(text[position])
				position++
			}
		}
		if name != "" {
			params[name] = strings.TrimSpace(value.String())
		}
	}
	return params
}

func NewDigestClientNonce() string {
	buffer := make([]byte, 16)
	rand.Read(buffer)
	return hex.EncodeToString(buffer)
}

func DigestAuthorization(challenge map[string]string, method string, uri string, username string, password string, clientNonce string) (string, error) {
	algorithm := challenge["algorithm"]
	if algorithm == "" {
		algorithm = "MD5"
	}
	baseAlgorithm, isSession := strings.CutSuffix(strings.ToUpper(algorithm), "-SESS")
	newHash, supported := digestHashes[baseAlgorithm]
	if !supported {
		return "", appErrors.New("vulpes.digestUnsupportedAlgorithm", "algoritmo Digest não suportado: {algorithm}").With("algorithm", algorithm)
	}
	digest := func(parts ...string) string {
		hasher := newHash()
		hasher.Write([]byte(strings.Join(parts, ":")))
		return hex.EncodeToString(hasher.Sum(nil))
	}

	realm, nonce := challenge["realm"], challenge["nonce"]
	firstHash := digest(username, realm, password)
	if isSession {
		firstHash = digest(firstHash, nonce, clientNonce)
	}
	secondHash := digest(method, uri)

	qop := ""
	for _, offered := range strings.Split(challenge["qop"], ",") {
		if strings.TrimSpace(offered) == "auth" {
			qop = "auth"
		}
	}
	if challenge["qop"] != "" && qop == "" {
		return "", appErrors.New("vulpes.digestUnsupportedQop", "o servidor exige qop \"{qop}\" no Digest, que não é suportado").With("qop", challenge["qop"])
	}

	const nonceCount = "00000001"
	response := digest(firstHash, nonce, secondHash)
	if qop != "" {
		response = digest(firstHash, nonce, nonceCount, clientNonce, qop, secondHash)
	}

	fields := []string{
		fmt.Sprintf(`username="%s"`, quoteEscaper.Replace(username)),
		fmt.Sprintf(`realm="%s"`, quoteEscaper.Replace(realm)),
		fmt.Sprintf(`nonce="%s"`, quoteEscaper.Replace(nonce)),
		fmt.Sprintf(`uri="%s"`, quoteEscaper.Replace(uri)),
		"algorithm=" + algorithm,
		fmt.Sprintf(`response="%s"`, response),
	}
	if qop != "" {
		fields = append(fields, "qop="+qop, "nc="+nonceCount, fmt.Sprintf(`cnonce="%s"`, clientNonce))
	}
	if opaque, found := challenge["opaque"]; found {
		fields = append(fields, fmt.Sprintf(`opaque="%s"`, quoteEscaper.Replace(opaque)))
	}
	return "Digest " + strings.Join(fields, ", "), nil
}
