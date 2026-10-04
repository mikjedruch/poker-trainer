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

---

## Etap 1.5 — wygląd (wspólny dla wszystkich narzędzi)

Najpierw zastosuj to do trenera matematyki, potem używaj w każdym kolejnym narzędziu.
Wszystkie kolory i rozmiary trzymaj jako tokeny w jednym pliku (`src/shared/theme.css`).

- **Motyw:** ciemny domyślnie (grafitowe tło, nie zielone sukno), jasny jako opcja. Jedna rodzina fontów,
  cyfry tabelaryczne (`font-variant-numeric: tabular-nums`) dla kwot i procentów.
- **Karty:** duże (min. 64 px szerokości na telefonie), biała karta, ranga i kolor czytelne z odległości ramienia.
  Talia czterokolorowa domyślnie: ♠ czarny, ♥ czerwony, ♦ niebieski, ♣ zielony (przełącznik w ustawieniach).
  Przy zadaniach z kolorem to zmniejsza błędy odczytu.
- **Stół:** schemat 6 miejsc z oznaczonymi pozycjami (UTG, HJ, CO, BTN, SB, BB), przyciskiem dealera,
  żetonami z kwotą w $ przed graczami, którzy wpłacili, i pulą na środku. Używany w preflopie i postflopie.
- **Odpowiedzi:** przyciski na dole ekranu w zasięgu kciuka, min. 48 px wysokości. Pola liczbowe z dużą klawiaturą numeryczną.
- **Informacja zwrotna:** natychmiastowa — zielone/czerwone podświetlenie wybranej odpowiedzi (≤ 200 ms),
  poniżej wysuwa się wyjaśnienie, przycisk „Dalej” w tym samym miejscu co odpowiedzi. Szanuj `prefers-reduced-motion`.
- **Statystyki:** prosty pasek trafności per typ zadania, bez wykresów dla ozdoby.

---

## Etap 2 — preflop (`src/tools/preflop`)

### Założenia gry
Live 6-max, $1/$2, efektywny stack $200. Typowy open przy stole: $7.
Strategie są czyste (każda ręka ma jedną akcję). Strategie mieszane to przyszły etap.
To bazowe zakresy pod live 1/2, nie wynik solvera. Trzymaj je jako dane, nie kod (`src/data/preflop.json`),
żeby dało się je później poprawiać bez ruszania logiki.

### Rozmiary zagrań bohatera
| Sytuacja | Kwota |
|---|---|
| Open (wszyscy spasowali) | $8; z SB $10 |
| Izolacja limperów, w pozycji | $12 przy 1 limperze, +$4 za każdego kolejnego |
| Izolacja limperów z SB/BB | jak wyżej + $3 |
| 3bet przeciw openowi $7 | w pozycji $25, bez pozycji (SB/BB) $30 |
| 4bet | $65 |

### Zakresy (wszystko, czego nie ma na liście, to fold; w BB bez podbicia: check)

| ID | Sytuacja | Raise | Call / limp |
|---|---|---|---|
| RFI_UTG | open z UTG | 66+, A9s+, A5s-A4s, KTs+, QTs+, JTs, T9s, AJo+, KQo | — |
| RFI_HJ | open z HJ | 55+, A8s+, A5s-A2s, K9s+, Q9s+, J9s+, T9s, 98s, 87s, ATo+, KJo+ | — |
| RFI_CO | open z CO | 22+, A2s+, K7s+, Q8s+, J8s+, T8s+, 97s+, 86s+, 76s, 65s, A9o+, KTo+, QTo+, JTo | — |
| RFI_BTN | open z BTN | 22+, A2s+, K5s+, Q7s+, J7s+, T7s+, 96s+, 86s+, 75s+, 64s+, 54s, A5o+, K9o+, Q9o+, J9o+, T9o | — |
| RFI_SB | open z SB (raise albo fold) | 22+, A2s+, K8s+, Q9s+, J9s+, T8s+, 98s, 87s, 76s, 65s, A8o+, KTo+, QJo | — |
| LIMP1_IP | 1 limper, bohater HJ/CO/BTN | 77+, ATs+, KJs+, QJs, AJo+, KQo | limp: 22-66, A2s-A9s, K9s-KTs, Q9s-QTs, J9s-JTs, T8s-T9s, 97s-98s, 86s-87s, 76s, 65s, 54s |
| LIMP2_IP | 2+ limperów, bohater HJ/CO/BTN | 88+, AJs+, KQs, AQo+ | limp: 22-77, A2s-ATs, KTs-KJs, QTs-QJs, J9s-JTs, T8s-T9s, 97s-98s, 86s-87s, 75s-76s, 64s-65s, 54s |
| LIMP_SB | limperzy, bohater SB | 99+, AJs+, KQs, AQo+ | dopłata: 22-88, A2s-ATs, K9s-KJs, Q9s-QJs, J9s-JTs, T8s-T9s, 97s-98s, 86s-87s, 75s-76s, 64s-65s, 54s, ATo-AJo, KJo-KQo, QJo |
| LIMP_BB | limperzy, bohater BB | TT+, AQs+, AKo | check: reszta |
| VS_EARLY_IP | open $7 z UTG/HJ, bohater HJ/CO/BTN | QQ+, AK | 22-JJ, ATs-AQs, KJs-KQs, QJs, JTs, T9s, 98s, AQo |
| VS_LATE_BTN | open $7 z CO, bohater BTN | JJ+, AQs+, AQo+ | 22-TT, A2s-AJs, KTs+, QTs+, J9s+, T9s, 98s, 87s, 76s, 65s, AJo, KQo |
| VS_OPEN_SB | open $7 z dowolnej pozycji, bohater SB | QQ+, AK, AQs | 22-JJ, ATs-AJs, KJs-KQs, QJs, JTs, T9s, 98s |
| BB_VS_EARLY | open $7 z UTG/HJ, bohater BB | QQ+, AK | 22-JJ, A2s-AQs, K9s+, Q9s+, J9s+, T8s+, 97s+, 86s+, 75s+, 64s+, 54s, AJo-AQo, KJo-KQo |
| BB_VS_LATE | open $7 z CO/BTN/SB, bohater BB | JJ+, AQs+, AQo+ | 22-TT, A2s-AJs, K5s+, Q7s+, J7s+, T7s+, 96s+, 85s+, 74s+, 63s+, 53s+, 43s, A7o-AJo, K9o+, Q9o+, J9o+, T9o, 98o |
| VS3B_IP | bohater otworzył, 3bet z blindów (bohater w pozycji) | 4bet: KK+, AKs | TT-QQ, AKo, AQs, AJs, KQs |
| VS3B_OOP | bohater otworzył, 3bet od gracza w pozycji | 4bet: KK+, AKs | JJ-QQ, AKo, AQs |

W VS3B_* bohater dostaje wyłącznie ręce z zakresu RFI swojej pozycji, bo innych by nie otworzył.
W wersji 1 nie ma callerów po openie (squeeze) — to znane ograniczenie.

### Obowiązkowe testy danych
Akcje w każdym scenariuszu są rozłączne. Liczba kombinacji (z 1326) musi się zgadzać dokładnie:

| ID | Raise | Call / limp |
|---|---|---|
| RFI_UTG | 158 | — |
| RFI_HJ | 220 | — |
| RFI_CO | 342 | — |
| RFI_BTN | 474 | — |
| RFI_SB | 310 | — |
| LIMP1_IP | 124 | 122 |
| LIMP2_IP | 82 | 140 |
| LIMP_SB | 76 | 214 |
| LIMP_BB | 50 | — |
| VS_EARLY_IP | 34 | 108 |
| VS_LATE_BTN | 56 | 166 |
| VS_OPEN_SB | 38 | 92 |
| BB_VS_EARLY | 34 | 232 |
| BB_VS_LATE | 56 | 426 |
| VS3B_IP | 16 | 42 |
| VS3B_OOP | 16 | 28 |

Jeśli liczby się nie zgadzają, błąd jest w parserze zakresów, nie w danych — popraw parser.

### Tryb 1: przeglądarka zakresów
Wybór scenariusza → siatka 13×13: raise czerwony, call/limp zielony, fold szary, check jasnoszary.
Pod siatką procent i liczba kombinacji każdej akcji. Dotknięcie komórki pokazuje akcję i wyjaśnienie.

### Tryb 2: drill
- Losowanie rodziny scenariuszy: RFI 30%, limperzy 30%, open przed Tobą 25%, 3bet 15%.
- Liczba limperów: 1 (50%), 2 (35%), 3 (15%). Limperzy siedzą wyłącznie przed bohaterem; pozycje muszą być spójne
  (np. HJ może mieć przed sobą najwyżej jednego limpera).
- Losowanie ręki ważone: ręka, której akcja różni się od akcji przynajmniej jednej sąsiedniej komórki siatki, ma wagę 3;
  oczywisty fold (wszyscy sąsiedzi też fold) wagę 0.3; reszta 1. Ręce graniczne uczą najwięcej.
- Ekran: stół z pozycjami i żetonami, historia akcji tekstem (np. „UTG limp $2, HJ limp $2 — Ty na CO: A♠9♠”),
  przyciski z kwotami („Fold”, „Limp $2”, „Raise do $16”).
- Po odpowiedzi: poprawna akcja, siatka scenariusza z zaznaczoną ręką i wyjaśnienie z kategorii poniżej.
- Postępy: trafność per rodzina scenariuszy i per pozycja, losowanie ważone błędami jak w Etapie 1.

### Wyjaśnienia (szablony wg kategorii ręki)
| Kategoria | Treść wyjaśnienia |
|---|---|
| Duże pary, AK | Ręka na value — podbijasz, żeby budować pulę i zawęzić pole. |
| Średnie pary 77–TT | Za mocne, żeby tylko limpować; przeciw 3betowi zwykle już tylko call albo fold. |
| Małe pary 22–66 | Set-mining: set trafiasz na flopie w 11.8% przypadków (ok. 1 na 8.5). Call opłaca się, gdy efektywny stack to min. ~15× kwoty calla. Przeciw 3betowi $25 przy $175 za plecami (7×) — fold. |
| Suited asy A2s–A5s | Nutowy kolor plus szansa na strit A–5; dobre w pulach multiway. |
| Suited connectory i one-gappery | Grają dobrze multiway i tanio; tracą wartość przy drogim wejściu i bez pozycji. |
| Offsuitowe broadwaye (KJo, QJo, ATo) | Często zdominowane przez lepsze kickery, szczególnie przeciw zakresom limperów i openów z wczesnych pozycji. |
| Słabe offsuitowe | Za mało equity i grywalności, żeby płacić za wejście. |

Każde wyjaśnienie kończ zdaniem o pozycji, jeśli w scenariuszu bohater jest bez pozycji po flopie.

### Definicja ukończenia
- Testy danych przechodzą (tabela kombinacji wyżej).
- Drill generuje tylko spójne sytuacje (test na 10 000 losowań: pozycje, limperzy, kwoty, ręka z dozwolonego zakresu w VS3B).
- Wygląd zgodny z Etapem 1.5, wdrożone na GitHub Pages.
