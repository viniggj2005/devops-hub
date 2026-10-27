package vulpesHandlers

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	vulpesDtos "docker-manager-go/src/vulpes/dtos"
	vulpesFunctions "docker-manager-go/src/vulpes/functions"
)

func TestHttpResponsesStoreCookiesInTheCollection(test *testing.T) {
	environment := setupVulpesTest(test)

	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		switch request.URL.Path {
		case "/login":
			http.SetCookie(writer, &http.Cookie{Name: "session", Value: "abc", Path: "/", HttpOnly: true})
		case "/hop":
			http.SetCookie(writer, &http.Cookie{Name: "hop", Value: "1", Path: "/"})
			http.Redirect(writer, request, "/me", http.StatusFound)
		case "/logout":
			http.SetCookie(writer, &http.Cookie{Name: "session", Path: "/", MaxAge: -1})
		}
		writer.Write([]byte(request.Header.Get("Cookie")))
	}))
	defer server.Close()

	collection, err := environment.vulpes.CreateCollection(environment.token, vulpesDtos.CollectionInputDto{Name: "API"})
	if err != nil {
		test.Fatalf("unexpected collection error: %v", err)
	}
	send := func(path string, collectionID uint) *vulpesDtos.HttpResponseDto {
		test.Helper()
		request := vulpesFunctions.NewRequest(vulpesDtos.ProtocolHttp)
		request.Http.Url = server.URL + path
		response, err := environment.client.SendHttpRequest(context.Background(), environment.token, vulpesDtos.ExecutionInputDto{
			Scope:   vulpesDtos.ExecutionScopeDto{CollectionID: collectionID},
			Request: request,
		})
		if err != nil {
			test.Fatalf("unexpected send error for %s: %v", path, err)
		}
		return response
	}

	login := send("/login", collection.ID)
	if login.CollectionCookies == nil || len(*login.CollectionCookies) != 1 || (*login.CollectionCookies)[0].Name != "session" || !(*login.CollectionCookies)[0].HostOnly {
		test.Fatalf("the response cookie must be stored in the collection: %+v", login.CollectionCookies)
	}
	if me := send("/me", collection.ID); me.Body != "session=abc" || me.CollectionCookies != nil {
		test.Fatalf("stored cookies must be sent and unchanged jars must not be reported: %q %+v", me.Body, me.CollectionCookies)
	}
	if hop := send("/hop", collection.ID); !strings.Contains(hop.Body, "hop=1") || !strings.Contains(hop.Body, "session=abc") {
		test.Fatalf("cookies set during redirects must be sent to the next hop: %q", hop.Body)
	}
	if scratch := send("/me", 0); scratch.Body != "" {
		test.Fatalf("requests outside a collection must not use its cookies: %q", scratch.Body)
	}

	logout := send("/logout", collection.ID)
	if logout.CollectionCookies == nil || len(*logout.CollectionCookies) != 1 || (*logout.CollectionCookies)[0].Name != "hop" {
		test.Fatalf("expired cookies must be removed from the collection: %+v", logout.CollectionCookies)
	}

	manual := []vulpesDtos.CookieDto{{Name: "manual", Value: "x", Domain: "127.0.0.1", Path: "/", HostOnly: true}}
	saved, err := environment.vulpes.SaveCollectionCookies(environment.token, collection.ID, manual)
	if err != nil || len(saved.Cookies) != 1 || saved.Cookies[0].Name != "manual" {
		test.Fatalf("unexpected saved cookies: %+v %v", saved, err)
	}
	if me := send("/me", collection.ID); me.Body != "manual=x" {
		test.Fatalf("manually created cookies must be sent: %q", me.Body)
	}
	if _, err := environment.vulpes.SaveCollectionCookies(environment.token, collection.ID, []vulpesDtos.CookieDto{{Name: "bad name", Domain: "x"}}); err == nil {
		test.Fatalf("expected invalid cookie names to fail")
	}
	if _, err := environment.vulpes.SaveCollectionCookies("invalid", collection.ID, manual); err == nil {
		test.Fatalf("expected invalid token to fail")
	}

	collections, _ := environment.vulpes.FindAllCollections(environment.token)
	if len(collections[0].Cookies) != 1 || collections[0].Cookies[0].Name != "manual" {
		test.Fatalf("cookies must be persisted with the collection: %+v", collections[0].Cookies)
	}
}
