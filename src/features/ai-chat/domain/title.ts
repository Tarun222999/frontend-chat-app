const MAX_TITLE_LENGTH = 60
const MAX_TITLE_WORDS = 6

const stopWords = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "can",
  "could",
  "for",
  "from",
  "help",
  "how",
  "i",
  "in",
  "into",
  "is",
  "it",
  "me",
  "my",
  "of",
  "on",
  "or",
  "our",
  "please",
  "should",
  "the",
  "this",
  "to",
  "vs",
  "we",
  "what",
  "with",
  "you",
])

const preserveCasePattern = /[A-Z]{2,}|\d|[a-z]+[A-Z]/

export const normalizeAiConversationTitle = (value: string) =>
  value
    .trim()
    .replace(/^["'`*_#\s]+|["'`*_\s.?!:;,-]+$/g, "")
    .replace(/\s+/g, " ")
    .slice(0, MAX_TITLE_LENGTH)
    .trim()

export const createFallbackAiConversationTitle = (message: string) => {
  const normalizedMessage = normalizeAiConversationTitle(
    message
      .replace(/https?:\/\/\S+/g, "")
      .replace(/[^\p{L}\p{N}\s'-]/gu, " "),
  )
  const words = normalizedMessage.split(/\s+/).filter(Boolean)
  const meaningfulWords = words.filter(
    (word) => !stopWords.has(word.toLowerCase()),
  )
  const titleWords = (meaningfulWords.length >= 2 ? meaningfulWords : words)
    .slice(0, MAX_TITLE_WORDS)
    .map((word) =>
      preserveCasePattern.test(word)
        ? word
        : `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`,
    )
  const title = titleWords.join(" ")

  return title.length > 0 ? title : "AI Chat"
}
