# Trener pokera — live 6-max NLHE 1/2

Aplikacja do nauki pokera dla gracza live 6-max, blindy $1/$2, efektywny stack 100bb ($200).
Właściciel projektu nie czyta kodu. Oceni aplikację po tym, czy działa i czy odpowiedzi są poprawne.
Dlatego poprawność pokerowa jest ważniejsza niż wszystko inne.

## Stack i zasady techniczne

- Vite + React + TypeScript (strict), Vitest do testów, vite-plugin-pwa (instalowalna na telefonie, działa offline).
- Hosting: GitHub Pages. Zero płatnych usług i zależności.
- Zależności tylko na licencjach MIT / BSD / Apache-2.0 / ISC. Żadnego GPL/AGPL — produkt może być kiedyś sprzedawany.
  Przed dodaniem zależności sprawdź licencję i napisz ją w commicie.
- Interfejs po polsku. Kod, nazwy i komentarze po angielsku.
- Kwoty w interfejsie w dolarach przy blindach 1/2, nie w bb.
- Postępy użytkownika w localStorage, każdy odczyt i zapis w try/catch.
- Mobile-first: wszystko musi być wygodne na telefonie jedną ręką.

## Struktura

```
src/core/      logika pokerowa, zero zależności od UI, pełne testy
src/shared/    wspólne komponenty UI (karta, siatka zakresu 13×13, zapis postępów)
src/tools/     jedno narzędzie = jeden folder, dostępne jako osobna trasa
  math/        Etap 1
  preflop/     Etap 2 (specyfikacja w przygotowaniu)
  postflop/    Etap 3 (specyfikacja w przygotowaniu)
  rules/       Etap 4 (specyfikacja w przygotowaniu)
```

## Zasady pracy

1. Każdy etap zaczynaj od planu i pokaż go przed implementacją.
2. `src/core` powstaje test-first. Etap nie jest skończony, dopóki `npm test` nie przechodzi.
3. Żadnej odpowiedzi pokerowej nie wpisuj na sztywno w UI. Każdą poprawną odpowiedź liczy `src/core`.
4. Po każdym etapie: commit, krótkie podsumowanie po polsku (co działa, jak uruchomić), lista znanych ograniczeń.

---

## Etap 0 — rdzeń (`src/core`)

### Moduły
- `cards.ts` — karty w notacji `As`, `Td`, `2c`; talia; parsowanie i formatowanie.
- `evaluator.ts` — ocena najlepszego 5-kartowego układu z 5, 6 lub 7 kart; zwraca porównywalną siłę oraz nazwę układu po polsku
  (wysoka karta, para, dwie pary, trójka, strit, kolor, full, kareta, poker).
- `equity.ts` — equity ręka vs ręka: dokładna enumeracja, gdy do rozdania zostało ≤ 2 kart (flop, turn),
  Monte Carlo (domyślnie 50 000 prób, ziarno ustawialne) dla preflopu w UI. Equity = wygrane + remisy/2.
- `range.ts` — parser zakresów: `AA`, `77+`, `22-55`, `AJs+`, `KQo`, `A2s-A5s`, `AK` (= suited + offsuit),
  lista kombinacji z usunięciem kart martwych. Konwersja do/z siatki 13×13.
- `outs.ts` — dla ręki bohatera, konkretnej ręki przeciwnika i boardu (flop lub turn) zwraca karty, które na następnej ulicy
  dają bohaterowi wygraną. Osobno oznacza „fałszywe outy”: karty, które poprawiają układ bohatera, ale i tak przegrywa.

### Obowiązkowe testy (wartości policzone dokładnie, zweryfikowane dwoma niezależnymi ewaluatorami)

Equity preflop, dokładna enumeracja 1 712 304 boardów (test może trwać kilka sekund):

| Bohater | Przeciwnik | Wygrana % | Remis % |
|---|---|---|---|
| AsAh | KdKc | 81.065 | 0.382 |
| AhKh | 2s2c | 49.770 | 0.629 |
| AhKd | QsQc | 42.664 | 0.342 |

Equity postflop, dokładnie:

| Bohater | Przeciwnik | Board | Wygrana % | Liczba boardów |
|---|---|---|---|---|
| Ah5h | KsKd | Kh 9h 2c | 25.556 | 990 |
| 8s7s | AdAc | 6h 5d 2c | 34.242 | 990 |
| Ah5h | KsKd | Kh 9h 2c 3d | 22.727 | 44 |

Outy dla ostatniego przypadku (turn): dokładnie 10 → `4h 6h 7h 8h Th Jh Qh` (kolor) + `4s 4c 4d` (strit A–5).
Fałszywe outy: `2h 3h` (kolor, ale przeciwnik trafia fulla).

Ewaluator — minimum:
- strit A-2-3-4-5 przegrywa ze stritem 2-3-4-5-6; A-K-Q-J-T wygrywa;
- kolor bije strit, full bije kolor, full wyższej trójki wygrywa niezależnie od pary;
- dwie pary z tym samym układem rozstrzyga kicker; board gra dla obu → remis;
- 7 kart z dwoma możliwymi kolorami/stritami wybiera najlepszy układ.
- Test Monte Carlo: AsAh vs KdKc przy 200 000 próbach mieści się w ±0.5 pp od wartości dokładnej.

---

## Etap 1 — trener matematyki (`src/tools/math`)

Losowe zadania, natychmiastowa odpowiedź, wyjaśnienie z podstawionymi liczbami.

### Generator sytuacji (realistyczny live 1/2)
- Pula przed betem: $15–$300. Bet jako 1/3, 1/2, 2/3, 3/4, 1× lub 1.5× puli, zaokrąglony do $5.
- Efektywny stack ≤ $200 minus to, co już jest w puli od gracza; bet nigdy nie przekracza pozostałego stacka.
- Zadania z equity: konkretna ręka bohatera z drawem vs konkretna ręka przeciwnika (nie zakres), board flop albo turn.
  Kategorie drawów losowane równomiernie: flush draw, OESD, gutshot, combo draw (kolor + strit), dwie overkarty,
  para + draw. Generuj przez losowanie z odrzucaniem, aż ręka pasuje do kategorii.

### Typy zadań
| # | Zadanie | Poprawna odpowiedź | Tolerancja |
|---|---|---|---|
| 1 | Ile masz outów? | `outs.ts` | dokładnie |
| 2 | Oszacuj equity | dokładne equity | ±5 pp; w wyjaśnieniu pokaż też regułę 2/4 i o ile się myli |
| 3 | Jakiego equity potrzebujesz do calla? (bet X do puli P) | X / (P + 2X) | ±2 pp |
| 4 | Call czy fold? | call ⇔ EV(call) = e·(P + 2X) − X > 0 | dokładnie; pokaż EV w $ |
| 5 | MDF: jak często musisz bronić przed betem X do P? | P / (P + X) | ±2 pp |
| 6 | Jak często bluff X do puli P musi przejść? | X / (P + X) | ±2 pp |
| 7 | Implied odds: ile $ musisz średnio wygrać na riverze, żeby call na turnie był na zero? | W = (1 − e)·X / e − P − X (0, jeśli call jest już +EV) | ±$5; jeśli W > pozostały stack, poprawna odpowiedź to „nie da się” |

### Wyjaśnienia po odpowiedzi
- Zawsze wzór z podstawionymi liczbami, np. „40 / (65 + 80) = 27.6%”.
- Przy outach: lista kart pogrupowana po tym, co dają, plus osobno fałszywe outy z powodem.
- Przy equity: dokładna wartość, szacunek z reguły 2/4 i komentarz, gdy różnica > 5 pp (typowo: fałszywe outy, zdominowane drawy).

### Postępy
- Trafność per typ zadania, zapisana w localStorage; ekran statystyk.
- Losowanie typu ważone błędami: typ z niższą trafnością pojawia się częściej (waga ∝ 1 − trafność z ostatnich 20 prób, min. 0.1).
- Tryb „wybierz typ”, gdy użytkownik chce ćwiczyć jedno.

### Definicja ukończenia
- Wszystkie testy z Etapu 0 przechodzą.
- Dla każdego z 7 typów: test, że generator daje poprawne, spójne dane (bet ≤ stack, karty się nie powtarzają,
  odpowiedź z UI == odpowiedź z core).
- Aplikacja zbudowana, działa offline po pierwszym wejściu, wdrożona na GitHub Pages.
