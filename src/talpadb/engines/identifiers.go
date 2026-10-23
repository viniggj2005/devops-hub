package talpadbEngines

import (
	"regexp"
	"strings"
)

var plainIdentifier = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]*$`)

var uppercaseIdentifier = regexp.MustCompile(`^[A-Z][A-Z0-9_$#]*$`)

var reservedWords = map[string]bool{}

func init() {
	for _, word := range strings.Fields(`
		ACCESS ADD ALL ALTER AND ANY AS ASC AUDIT BETWEEN BY CASE CHAR CHECK CLUSTER COLUMN COMMENT
		COMPRESS CONNECT CONSTRAINT CREATE CROSS CURRENT DATE DECIMAL DEFAULT DELETE DESC DISTINCT DROP
		ELSE END ESCAPE EXCEPT EXCLUSIVE EXISTS FILE FLOAT FOR FOREIGN FROM FULL GRANT GROUP HAVING
		IDENTIFIED IMMEDIATE IN INCREMENT INDEX INITIAL INNER INSERT INTEGER INTERSECT INTO IS JOIN KEY
		LEFT LEVEL LIKE LIMIT LOCK LONG MAXEXTENTS MINUS MODE MODIFY NATURAL NOT NOWAIT NULL NUMBER OF
		OFFLINE OFFSET ON ONLINE OPTION OR ORDER OUTER PCTFREE PRIMARY PRIOR PUBLIC RAW REFERENCES RENAME
		RESOURCE REVOKE RIGHT ROW ROWID ROWNUM ROWS SELECT SESSION SET SHARE SIZE SMALLINT START
		SYNONYM SYSDATE TABLE THEN TO TRIGGER UID UNION UNIQUE UPDATE USER USING VALIDATE VALUES
		VARCHAR VARCHAR2 VIEW WHEN WHENEVER WHERE WITH`) {
		reservedWords[word] = true
	}
}

func quoteIfNeeded(name string, quote func(string) string, uppercaseOnly bool) string {
	pattern := plainIdentifier
	if uppercaseOnly {
		pattern = uppercaseIdentifier
	}
	if pattern.MatchString(name) && !reservedWords[strings.ToUpper(name)] {
		return name
	}
	return quote(name)
}
