import re
import unicodedata
from dataclasses import dataclass

import snowballstemmer
from rank_bm25 import BM25L

from .models import KnowledgeChunk
from .selectors import accessible_chunks

STOP_WORDS = frozenset(
    "а без бы в во вы где да для до его ее если есть еще же за и из или им их к как какой какая какие "
    "какое когда кто ли мне мой мы на над надо нам не но о об он она они от по под при про с со так "
    "то у уже чем что это я нужно могу можно сколько пожалуйста расскажи объясни узнать хочу после происходит "
    "the a an how what can i is are to of for in on please tell me "
    "мен және қалай қай қандай үшін туралы бұл ма ме кім қашан қанша керек".split()
)
GENERIC_TERMS = frozenset({"заявк", "оформ", "порядок", "правил", "пода", "соглас", "срок"})
_RUSSIAN = snowballstemmer.stemmer("russian")
_ENGLISH = snowballstemmer.stemmer("english")
_ALIASES = {
    "заявлен": "заявк",
    "подав": "пода",
    "оформлен": "оформ",
    "согласова": "соглас",
    "согласовыва": "соглас",
    "согласован": "соглас",
    "согласу": "соглас",
}
_INSTRUCTION_PATTERNS = (
    r"(?:ignore|disregard|forget).{0,50}(?:instructions|rules|prompt)",
    r"(?:игнорир|забуд|отмени).{0,60}(?:инструкц|правил|промпт)",
    r"(?:system|developer)\s*(?:prompt|message|:)",
    r"(?:покажи|раскрой|выведи).{0,40}(?:секрет|парол|ключ|системн.+промпт)",
    r"(?:approve|одобри|уволь|откажи).{0,50}(?:request|заявк|сотрудник)",
)


@dataclass(frozen=True)
class RetrievedChunk:
    chunk: KnowledgeChunk
    score: float
    coverage: float


@dataclass(frozen=True)
class RetrievalResult:
    chunks: tuple[RetrievedChunk, ...]
    reason: str


def tokenize(text, language="ru"):
    normalized = unicodedata.normalize("NFKC", text).casefold().replace("ё", "е")
    words = re.findall(r"[^\W_]+", normalized, flags=re.UNICODE)
    words = [word for word in words if word not in STOP_WORDS and len(word) > 1]
    result = []
    for word in words:
        if re.fullmatch(r"[a-z]+", word):
            token = _ENGLISH.stemWord(word)
        elif language == "ru" and re.fullmatch(r"[а-я]+", word):
            token = _RUSSIAN.stemWord(word)
        else:
            token = word
        result.append(_ALIASES.get(token, token))
    return result


def contains_unsafe_instruction(text):
    normalized = unicodedata.normalize("NFKC", text).casefold()
    return any(re.search(pattern, normalized, flags=re.DOTALL) for pattern in _INSTRUCTION_PATTERNS)


def retrieve(user, question, language="ru", limit=4):
    candidates = list(accessible_chunks(user, current_only=True, language=language))
    return rank_chunks(candidates, question, language, limit)


def rank_chunks(candidates, question, language="ru", limit=4):
    candidates = list(candidates)
    if contains_unsafe_instruction(question):
        return RetrievalResult((), "unsafe_instruction")
    query = set(tokenize(question, language))
    if len(query) < 2 or query.issubset(GENERIC_TERMS):
        return RetrievalResult((), "clarification_required")
    if not candidates:
        return RetrievalResult((), "no_matching_policy")
    corpus = [
        tokenize(f"{chunk.heading} {chunk.revision.title} {chunk.text}", language)
        for chunk in candidates
    ]
    if not any(corpus):
        return RetrievalResult((), "no_matching_policy")
    scores = BM25L(corpus).get_scores(list(query))
    matches = []
    for chunk, tokens, score in zip(candidates, corpus, scores, strict=True):
        overlap = query & set(tokens)
        coverage = len(overlap) / len(query)
        if len(overlap) >= 2 and coverage >= 2 / 3 and not contains_unsafe_instruction(chunk.text):
            matches.append(RetrievedChunk(chunk, float(score), coverage))
    matches.sort(key=lambda item: (-item.coverage, -item.score, str(item.chunk.id)))
    if not matches:
        return RetrievalResult((), "no_matching_policy")
    first = matches[0]
    if len(matches) > 1:
        second = next(
            (
                item
                for item in matches[1:]
                if item.chunk.revision.topic != first.chunk.revision.topic
            ),
            None,
        )
        if second and second.coverage == first.coverage and second.score >= first.score * 0.95:
            return RetrievalResult((), "clarification_required")
    same_topic = tuple(
        item for item in matches if item.chunk.revision.topic == first.chunk.revision.topic
    )
    return RetrievalResult(same_topic[:limit], "lexical_evidence")
