package octohubStructs

type Commit struct {
	Hash        string
	Author      string
	Email       string
	PseudoEmail string
	Date        string
	Title       string
}

type FileModification struct {
	File   string
	Status string
}
