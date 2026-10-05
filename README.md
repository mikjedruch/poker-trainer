# Trener pokera

Aplikacja do nauki pokera dla gracza live 6-max NLHE, blindy $1/$2, stack $200.
Działa w przeglądarce i na telefonie (można ją zainstalować jako aplikację; po pierwszym otwarciu działa offline).

**Adres:** https://mikjedruch.github.io/poker-trainer/

## Co już działa

- **Matematyka** — 7 typów zadań: outy, equity, pot odds, call/fold, MDF, bluff, implied odds.
  Po każdej odpowiedzi wyjaśnienie z podstawionymi liczbami. Statystyki trafności;
  w trybie „Mieszane” częściej losują się typy, w których robisz więcej błędów.
- **Preflop** — trzy zakładki:
  - **Drill**: stół 6-max z żetonami, historia akcji, Twoja ręka i przyciski z kwotami („Limp $2”, „Raise do $16”).
    Rodzaje sytuacji: open, limperzy przed Tobą, open przed Tobą, 3bet po Twoim opencie (albo „Mieszane”).
    Po odpowiedzi: poprawna akcja, wyjaśnienie i siatka zakresu z zaznaczoną ręką.
    Częściej losują się ręce graniczne oraz sytuacje i pozycje, w których robisz błędy.
  - **Zakresy**: 16 sytuacji na siatce 13×13 (raise czerwony, call/limp zielony, fold szary, check jasnoszary),
    liczba kombinacji i procent każdej akcji, po dotknięciu ręki — akcja i wyjaśnienie.
  - **Statystyki**: trafność dla każdego rodzaju sytuacji i każdej pozycji.

  Zakresy i kwoty są w pliku `src/data/preflop.json` — można je poprawiać bez zmian w kodzie.
- **Postflop** — c-bet na flopie, gdy otworzyłeś preflop. Cztery zakładki:
  - **Quiz**: tekstura flopu (kolory, wysokość, suchy/mokry), strategia c-betu dla całego zakresu,
    decyzja konkretną ręką (check / bet z kwotą) i sizing (odsetek blefów albo MDF). Częściej losują się
    rodzaje zadań i sytuacje, w których robisz błędy.
  - **Analiza**: dowolny flop — tekstura, dokładne equity zakresów (E), przewaga silnych rąk (N), strategia,
    rozkład rąk obu graczy, siatka Twoich decyzji, porównanie z profilem baseline i suwak rozmiaru betu.
  - **Profile**: przeciwnicy `baseline` i `loose-live` oraz własne kopie. Zakresy przeciwnika edytujesz palcem
    na siatce albo notacją; aktywny profil działa w quizie i w analizie.
  - **Statystyki**: trafność dla każdego rodzaju zadania i każdej sytuacji.

  Liczby są dokładne (liczone w tle, bez blokowania ekranu); strategia to heurystyka „reguła bazowa v1”.
  Profile są w `src/data/profiles.json`. Do quizu przy budowaniu liczy się biblioteka 150 flopów
  (`npm run precompute`, kilka minut; pomijana, gdy zakresy się nie zmieniły).
- **Wygląd** — ciemny motyw (domyślny) albo jasny, talia 4-kolorowa (domyślna) albo 2-kolorowa:
  przełączniki w **Ustawieniach** na ekranie głównym. Duże karty, odpowiedzi wpisywane na dużej klawiaturze
  na dole ekranu, „Dalej” w tym samym miejscu co przycisk odpowiedzi.

## Uruchomienie lokalnie

Wymaga Node.js 20 lub nowszego.

```
npm install
npm run dev        # aplikacja na http://localhost:5173/poker-trainer/
npm test           # wszystkie testy (ok. 1 min)
npm run build      # wersja produkcyjna do katalogu dist/
npm run preview    # podgląd wersji produkcyjnej
```

Każdy push na gałąź `main` uruchamia testy i — jeśli przejdą — publikuje aplikację na GitHub Pages.
