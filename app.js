/* Big Idea Studio — jeden plik, dziewięć zadań. Kolejność ma znaczenie.
   Cały ruch jest wyłączany jednym warunkiem: prefers-reduced-motion. */

(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasIO = 'IntersectionObserver' in window;

  /* Wspólny obserwator: element wchodzi na ekran raz i zostaje odsłonięty.
     Margines -12% od dołu opóźnia start do momentu, w którym element jest już widoczny,
     a nie dopiero dotknął krawędzi. */
  function reveal(nodes) {
    if (!nodes.length) return;

    if (reduced || !hasIO) {
      nodes.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.05 });

    nodes.forEach(function (el) { io.observe(el); });
  }

  /* 1. Nagłówki na maskę: każda linia dostaje własną ramkę z ukryciem przepełnienia
     i wjeżdża spod jej krawędzi. Podział idzie po <br>, więc łamanie zostaje w markupie.
     Przy wyłączonym ruchu nie ruszamy struktury w ogóle — tekst zostaje, jak był. */
  var masked = [].slice.call(document.querySelectorAll('[data-mask]'));

  if (masked.length && !reduced) {
    masked.forEach(function (el) {
      var lines = el.innerHTML.split(/<br\s*\/?>/i);
      el.innerHTML = lines.map(function (line, i) {
        return '<span class="mask" style="--d:' + (i * 110) + 'ms"><i>' + line + '</i></span>';
      }).join('');
    });
    reveal(masked);
  }

  /* 2. Odsłanianie treści. Kaskada liczona w obrębie sekcji, nie całej strony —
     inaczej ostatnie elementy czekałyby sekundę na swoją kolej. */
  var revealables = [].slice.call(document.querySelectorAll('[data-reveal]'));

  revealables.forEach(function (el) {
    // Opis w sekcji Obszary liczy kaskadę sam dla siebie — inaczej piąty czekałby pół sekundy.
    var section = el.closest('[data-reveal-scope], section');
    if (!section) return;
    var peers = section.hasAttribute('data-reveal-scope')
      ? [section]
      : [].slice.call(section.querySelectorAll('[data-reveal]'));
    el.style.transitionDelay = Math.min(peers.indexOf(el), 5) * 90 + 'ms';
  });

  reveal(revealables);

  /* 3. Schemat kół: wchodzą od środka układu na zewnątrz, bo growth management
     jest tu punktem wyjścia, a nie jedną z pięciu pozycji. */
  var kola = document.querySelector('[data-kola]');

  if (kola) {
    /* Opóźnienie liczone od odległości na ekranie, nie od pozycji w kodzie:
       hub jest pierwszy w kodzie, ale stoi w środku układu. Koła w tej samej
       odległości od huba (pary po bokach, para na dole) wchodzą razem. */
    var items = [].slice.call(kola.children);
    var hubEl = kola.querySelector('.is-hub') || items[0];
    var center = function (el) {
      var r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width || 1 };
    };
    var hc = center(hubEl);
    var rings = items.map(function (li) {
      var c = center(li);
      return Math.round(Math.hypot(c.x - hc.x, c.y - hc.y) / (hc.w * .25));
    });
    var steps = rings.filter(function (v, i) { return rings.indexOf(v) === i; })
      .sort(function (a, b) { return a - b; });
    items.forEach(function (li, i) {
      li.style.setProperty('--d', steps.indexOf(rings[i]) * 120 + 'ms');
    });
    reveal([kola]);
  }

  /* 4. Obszary: nazwa po lewej dostaje pełny kolor, gdy jej opis przecina środek ekranu.
     Obserwator patrzy na pas o zerowej wysokości w połowie widoku, więc aktywny jest
     zawsze dokładnie jeden opis. Bez IntersectionObserver lista zostaje w pełnym kolorze. */
  var obszary = document.querySelector('.obszary');

  if (obszary && hasIO) {
    var links = {};
    [].slice.call(obszary.querySelectorAll('.obszary-lista a')).forEach(function (a) {
      links[a.getAttribute('href').slice(1)] = a;
    });
    var panels = [].slice.call(obszary.querySelectorAll('[data-obszar]'));

    var setActive = function (id) {
      Object.keys(links).forEach(function (key) {
        if (key === id) links[key].setAttribute('aria-current', 'true');
        else links[key].removeAttribute('aria-current');
      });
    };

    if (panels.length) {
      setActive(panels[0].id);
      obszary.classList.add('is-live');

      var obsIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      }, { rootMargin: '-50% 0px -50% 0px', threshold: 0 });

      panels.forEach(function (el) { obsIO.observe(el); });
    }
  }

  /* 5. Scena: wspólne tło sekcji O mnie, współpracy i kontaktu, mieszane ze scrollem.
     Trzy warstwy płynności:
     a) Czysty ton jest w trzech punktach: O mnie — dopóki jej dół nie dojdzie do dołu ekranu
        (do tego momentu stoi w oryginalnej Ultra z białym tekstem; sekcja bywa wyższa
        niż ekran, więc czytany tekst nie zmienia koloru w połowie), grafit — w środku sceny, Ultra — gdy góra kontaktu jest na 20% wysokości ekranu
        (od tego miejsca do końca strony kontakt stoi w oryginalnej Ultra z bielą).
     b) Mieszanie w OKLab, liniowo: równy kawałek przewinięcia = równa, widoczna zmiana barwy.
     c) Wygładzanie w czasie. Kółko myszy przesuwa stronę skokami po ~100 px — gdyby kolor
        szedł wprost za pozycją, każdy „ząbek” dawałby skok barwy. Kolor goni pozycję
        z opóźnieniem ~0,25 s, więc między ząbkami przechodzi przez wszystkie odcienie pośrednie.
     Zmiana koloru nie jest ruchem na ekranie, więc działa także przy ograniczonym ruchu.
     Kolory pochodzą z tokenów w :root — zmiana palety w CSS zmienia też scenę. */
  var scena = document.querySelector('[data-scena]');

  if (scena) {
    var tony = [].slice.call(scena.querySelectorAll('[data-ton]'));

    if (tony.length > 1) {
      scena.setAttribute('data-ton-now', tony[0].getAttribute('data-ton'));
      scena.classList.add('is-live');

      if (!('requestAnimationFrame' in window)) {
        if (hasIO) {
          var tonIO = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
              if (entry.isIntersecting) scena.setAttribute('data-ton-now', entry.target.getAttribute('data-ton'));
            });
          }, { rootMargin: '-50% 0px -50% 0px', threshold: 0 });
          tony.forEach(function (el) { tonIO.observe(el); });
        }
      } else {
        var rootCS = getComputedStyle(document.documentElement);
        var hex = function (name) {
          var h = rootCS.getPropertyValue(name).trim().replace('#', '');
          return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)];
        };

        // sRGB (0–255) ⇄ OKLab — wzory Björna Ottossona
        var toLin = function (c) { c /= 255; return c <= .04045 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); };
        var fromLin = function (c) {
          c = c <= .0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - .055;
          return Math.max(0, Math.min(255, c * 255));
        };
        var toLab = function (rgb) {
          var r = toLin(rgb[0]), g = toLin(rgb[1]), b = toLin(rgb[2]);
          var l = Math.cbrt(.4122214708 * r + .5363325363 * g + .0514459929 * b);
          var m = Math.cbrt(.2119034982 * r + .6806995451 * g + .1073969566 * b);
          var s = Math.cbrt(.0883024619 * r + .2817188376 * g + .6299787005 * b);
          return [.2104542553 * l + .7936177850 * m - .0040720468 * s,
                  1.9779984951 * l - 2.4285922050 * m + .4505937099 * s,
                  .0259040371 * l + .7827717662 * m - .8086757660 * s];
        };
        var toRGB = function (lab) {
          var l = lab[0] + .3963377774 * lab[1] + .2158037573 * lab[2];
          var m = lab[0] - .1055613458 * lab[1] - .0638541728 * lab[2];
          var s = lab[0] - .0894841775 * lab[1] - 1.2914855480 * lab[2];
          l = l * l * l; m = m * m * m; s = s * s * s;
          return [fromLin(4.0767416621 * l - 3.3077115913 * m + .2309699292 * s),
                  fromLin(-1.2684380046 * l + 2.6097574011 * m - .3413193965 * s),
                  fromLin(-.0041960863 * l - .7034186147 * m + 1.7076147010 * s)];
        };

        var ultra = toLab(hex('--bis-accent')), ink = toLab(hex('--bis-ink'));
        var lt = toLab(hex('--bis-accent-lt')), white = toLab([255, 255, 255]);

        // każdy ton: tło, tekst, tekst drugorzędny (+ krycie), linia (+ krycie)
        var PALETA = {
          ultra: { bg: ultra, fg: white, fg2a: .78, rulea: .28 },
          ink:   { bg: ink,   fg: lt,    fg2a: 1,   rulea: .28 }
        };

        var lerp = function (a, b, t) { return a + (b - a) * t; };
        var mix3 = function (a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; };
        var css = function (lab, a) {
          var c = toRGB(lab);
          return 'rgba(' + c[0].toFixed(1) + ',' + c[1].toFixed(1) + ',' + c[2].toFixed(1) + ',' + a.toFixed(3) + ')';
        };

        // Punkty czystego tonu w pikselach dokumentu. Liczone przy starcie i zmianie rozmiaru,
        // nie w każdej klatce — przewijanie nie zmienia układu.
        var punkty = [];
        var zmierz = function () {
          var vh = window.innerHeight, sy = window.pageYOffset;
          var maxY = document.documentElement.scrollHeight - vh;
          punkty = tony.map(function (el, i) {
            var r = el.getBoundingClientRect(), top = r.top + sy, y;
            if (i === 0) y = top + Math.max(0, r.height - vh);    // O mnie czytana w całości — czysta Ultra z bielą
            else if (i === tony.length - 1) y = Math.min(top - vh * .2, maxY);  // kontakt: czysta Ultra, zanim nagłówek dojdzie do góry ekranu
            else y = top + r.height / 2 - vh / 2;
            return { y: y, ton: PALETA[el.getAttribute('data-ton')] };
          });
          // Sekcje środkowe: punkt w pół drogi między „środek na środku ekranu” a środkiem
          // całej sceny — obie połowy przejścia mają podobną długość, więc żadna nie jest stroma.
          var y0 = punkty[0].y, yN = punkty[punkty.length - 1].y;
          for (var m = 1; m < punkty.length - 1; m++) {
            punkty[m].y = (punkty[m].y + (y0 + (yN - y0) * m / (punkty.length - 1))) / 2;
          }
          for (var k = 1; k < punkty.length; k++) {          // punkty muszą rosnąć
            if (punkty[k].y <= punkty[k - 1].y) punkty[k].y = punkty[k - 1].y + 1;
          }
        };

        var TAU = 250;            // ms — stała wygładzania; większa = łagodniej, ale z większym opóźnieniem
        var yPokaz = window.pageYOffset;
        var ostatnio = 0, biegnie = false;

        var maluj = function (y) {
          var a = punkty[0], b = punkty[0], t = 0;

          if (y >= punkty[punkty.length - 1].y) {
            a = b = punkty[punkty.length - 1];
          } else if (y > punkty[0].y) {
            for (var i = 0; i < punkty.length - 1; i++) {
              if (y < punkty[i + 1].y) {
                a = punkty[i]; b = punkty[i + 1];
                t = (y - a.y) / (b.y - a.y);
                break;
              }
            }
          }

          var fg = mix3(a.ton.fg, b.ton.fg, t);
          var s = scena.style;
          s.setProperty('--bg', css(mix3(a.ton.bg, b.ton.bg, t), 1));
          s.setProperty('--fg', css(fg, 1));
          s.setProperty('--accent', css(fg, 1));
          s.setProperty('--fg-2', css(fg, lerp(a.ton.fg2a, b.ton.fg2a, t)));
          s.setProperty('--rule', css(fg, lerp(a.ton.rulea, b.ton.rulea, t)));
        };

        // Pętla działa tylko, dopóki kolor nie dogoni pozycji — potem stoi i nie zjada baterii.
        var klatka = function (teraz) {
          var dt = ostatnio ? Math.min(64, teraz - ostatnio) : 16;
          ostatnio = teraz;
          var cel = window.pageYOffset;
          yPokaz += (cel - yPokaz) * (1 - Math.exp(-dt / TAU));
          if (Math.abs(cel - yPokaz) < .5) yPokaz = cel;
          maluj(yPokaz);
          if (yPokaz !== cel) window.requestAnimationFrame(klatka);
          else { biegnie = false; ostatnio = 0; }
        };

        var prosba = function () {
          if (!biegnie) { biegnie = true; window.requestAnimationFrame(klatka); }
        };

        zmierz();
        maluj(yPokaz);
        window.addEventListener('scroll', prosba, { passive: true });
        window.addEventListener('resize', function () { zmierz(); maluj(yPokaz); prosba(); });
        window.addEventListener('load', function () { zmierz(); maluj(yPokaz); prosba(); });
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { zmierz(); maluj(yPokaz); });
      }
    }
  }

  /* 6. Paralaksa. Element sunie wolniej niż strona o wartość z data-px (w pikselach).
     Liczone względem środka ekranu, więc w punkcie zerowym element stoi tam,
     gdzie postawił go layout — pozycja bez skryptu jest zawsze poprawna.
     data-drift dostaje samą pozycję (--p, bez jednostki) — przesunięcie liczy CSS,
     bo poziomy ruch hasła musi skalować się z szerokością ekranu, nie w pikselach. */
  var pxNodes = [].slice.call(document.querySelectorAll('[data-px], [data-drift]'));

  if (pxNodes.length && !reduced) {
    var ticking = false;

    var onScroll = function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () {
        var vh = window.innerHeight || 1;
        pxNodes.forEach(function (el) {
          var r = el.getBoundingClientRect();
          if (r.bottom < -vh || r.top > vh * 2) return;   // poza zasięgiem: nie liczymy
          var p = (r.top + r.height / 2 - vh / 2) / vh;    // -1 nad ekranem, +1 pod
          el.style.setProperty('--p', p.toFixed(4));
          if (el.hasAttribute('data-px')) el.style.setProperty('--px', (p * parseFloat(el.dataset.px)).toFixed(1) + 'px');
        });
        ticking = false;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();
  }

  /* 6a. Kreski rysowane raz, przy wejściu na ekran (strzałka w „Dla kogo pracuję”). */
  reveal([].slice.call(document.querySelectorAll('[data-draw]')));

  /* 7. Pasek z logotypem i przyciskiem kontaktu — pojawia się dopiero, gdy hero zniknie z ekranu. */
  var bar = document.querySelector('.sticky');
  var hero = document.querySelector('.hero');

  if (bar && hero && hasIO) {
    new IntersectionObserver(function (entries) {
      bar.classList.toggle('is-on', !entries[0].isIntersecting);
    }, { threshold: 0 }).observe(hero);
  }

  /* 8. Rok w nocie prawnej — żeby nie zestarzał się bez powodu. */
  var year = document.querySelector('[data-year]');
  if (year) year.textContent = new Date().getFullYear();

  /* 9. Sygnał dla bezpiecznika w <head>: skrypt doszedł do końca, więc ukryta treść
     ma kto odsłonić. Bez tej flagi po zdarzeniu load klasa .js jest zdejmowana. */
  window.BIS_OK = true;
})();
