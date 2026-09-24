/* Big Idea Studio — jeden plik, jedenaście zadań. Kolejność ma znaczenie.
   Cały ruch jest wyłączany jednym warunkiem: prefers-reduced-motion. */

(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasIO = 'IntersectionObserver' in window;

  // Znacznik działającego skryptu — CSS ukrywa stany początkowe animacji tylko pod nim,
  // więc bez JS portret, znak w kontakcie i listy stoją w całości.
  document.documentElement.classList.add('js');

  var clamp01 = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };

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

  /* 2a. Listy wierszy (Dla kogo): kaskada liczona w obrębie listy.
     Uzbrajamy dopiero tutaj — bez skryptu lista stoi w całości.
     [data-anim]: elementy z własną animacją CSS (portret, znak w kontakcie). */
  var rows = [].slice.call(document.querySelectorAll('[data-rows]'));
  rows.forEach(function (list) {
    [].slice.call(list.children).forEach(function (li, i) { li.style.setProperty('--i', i); });
    list.classList.add('is-armed');
  });
  reveal(rows);
  reveal([].slice.call(document.querySelectorAll('[data-anim]')));

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
      var c = center(li);
      li.style.setProperty('--d', steps.indexOf(rings[i]) * 90 + 'ms');
      // start: 45% dalej od huba niż pozycja docelowa — koła zjeżdżają się do środka
      li.style.setProperty('--tx', ((c.x - hc.x) * .45).toFixed(1) + 'px');
      li.style.setProperty('--ty', ((c.y - hc.y) * .45).toFixed(1) + 'px');
    });
    reveal([kola]);
  }

  /* 4. Obszary. Desktop (min. 760 × 560 px, bez ograniczonego ruchu): kadr przypięty,
     przewijanie po torze przełącza opisy — aktywny jest dokładnie jeden, poprzednie
     dostają is-past. Oś przy liście pokazuje postęp (--p).
     Poza tym trybem: stary obserwator środka ekranu podświetla nazwę po lewej. */
  var obszary = document.querySelector('[data-obszary]');

  if (obszary) {
    var tor = obszary.querySelector('.obszary-tor');
    var postep = obszary.querySelector('.obszary-postep');
    var panels = [].slice.call(obszary.querySelectorAll('[data-obszar]'));
    var linkList = [].slice.call(obszary.querySelectorAll('.obszary-lista a'));
    var N = panels.length;
    var mqPin = window.matchMedia('(min-width: 760px) and (min-height: 560px)');
    var pin = false, aktywny = -1, obsTick = false;

    var setActive = function (idx) {
      if (idx === aktywny) return;
      aktywny = idx;
      panels.forEach(function (p, k) {
        p.classList.toggle('is-active', k === idx);
        p.classList.toggle('is-past', k < idx);
      });
      linkList.forEach(function (a, k) {
        if (k === idx) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      });
    };

    // odległość do przewinięcia w torze: wysokość toru minus jeden ekran
    var drogaToru = function () { return Math.max(1, tor.offsetHeight - window.innerHeight); };

    var liczPin = function () {
      obsTick = false;
      if (!pin) return;
      var p = clamp01(-tor.getBoundingClientRect().top / drogaToru());
      if (postep) postep.style.setProperty('--p', p.toFixed(4));
      setActive(Math.min(N - 1, Math.floor(p * N)));
    };

    var tryb = function () {
      pin = !reduced && mqPin.matches && N > 1;
      obszary.classList.toggle('is-pin', pin);
      obszary.style.setProperty('--n', N);
      if (!pin) {
        panels.forEach(function (p) { p.classList.remove('is-active', 'is-past'); });
        aktywny = -1;
      }
      liczPin();
    };

    if (N) {
      obszary.classList.add('is-live');
      setActive(0);
      tryb();

      window.addEventListener('scroll', function () {
        if (pin && !obsTick) { obsTick = true; window.requestAnimationFrame(liczPin); }
      }, { passive: true });
      window.addEventListener('resize', tryb);
      if (mqPin.addEventListener) mqPin.addEventListener('change', tryb);

      // Klik w nazwę w trybie przypiętym: środek odcinka toru należącego do opisu.
      linkList.forEach(function (a, k) {
        a.addEventListener('click', function (e) {
          if (!pin) return;
          e.preventDefault();
          var top = tor.getBoundingClientRect().top + window.pageYOffset;
          window.scrollTo({ top: top + drogaToru() * (k + .5) / N, behavior: reduced ? 'auto' : 'smooth' });
        });
      });

      if (hasIO) {
        var obsIO = new IntersectionObserver(function (entries) {
          if (pin) return;
          entries.forEach(function (entry) {
            if (entry.isIntersecting) { aktywny = -1; setActive(panels.indexOf(entry.target)); }
          });
        }, { rootMargin: '-50% 0px -50% 0px', threshold: 0 });
        panels.forEach(function (el) { obsIO.observe(el); });
      }
    }
  }

  /* 5. Scena: wspólne tło planszy, współpracy i kontaktu, mieszane ze scrollem.
     Trzy warstwy płynności:
     a) Czysty ton jest w trzech punktach: plansza — gdy wypełnia ekran (do tego momentu
        stoi w oryginalnej Ultra z białym tekstem), grafit — w środku sceny, Ultra — gdy góra kontaktu jest na 20% wysokości ekranu
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
            if (i === 0) y = top;                                 // plansza wypełnia ekran — czysta Ultra z bielą
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
     bo poziomy ruch nazwiska w „O mnie” skaluje się z szerokością ekranu, nie w pikselach. */
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

  /* 7. Kurtyna i pasek. Hero przypięte, „Punkt wyjścia” najeżdża na nie od dołu.
     --hero-top: przy hero wyższym niż okno (niski telefon) hero najpierw przewija się
     do końca i dopiero wtedy staje — inaczej dół wejścia byłby nie do zobaczenia.
     --cover (0–1): jak daleko zasłona weszła na ekran. Pasek z logo pojawia się,
     gdy zasłona dojdzie do góry okna. */
  var kurtyna = document.querySelector('[data-kurtyna]');
  var hero = document.querySelector('.hero');
  var punkt = document.querySelector('.punkt');
  var bar = document.querySelector('.sticky');

  if (kurtyna && hero && punkt) {
    var kurtynaLive = !reduced;
    kurtyna.classList.toggle('is-live', kurtynaLive);
    var kTick = false;

    var ustawKurtyne = function () {
      kTick = false;
      var vh = window.innerHeight || 1;
      var pTop = punkt.getBoundingClientRect().top;
      if (kurtynaLive) {
        hero.style.setProperty('--hero-top', Math.min(0, vh - hero.offsetHeight) + 'px');
        hero.style.setProperty('--cover', clamp01(1 - pTop / vh).toFixed(4));
      }
      if (bar) bar.classList.toggle('is-on', pTop <= 1);
    };

    var prosbaK = function () {
      if (!kTick) { kTick = true; window.requestAnimationFrame(ustawKurtyne); }
    };

    ustawKurtyne();
    window.addEventListener('scroll', prosbaK, { passive: true });
    window.addEventListener('resize', prosbaK);
  } else if (bar && hero && hasIO) {
    new IntersectionObserver(function (entries) {
      bar.classList.toggle('is-on', !entries[0].isIntersecting);
    }, { threshold: 0 }).observe(hero);
  }

  /* 7a. Teza spod belek. Tekst dzielony na słowa (każde razem ze spacją za nim, więc belki
     łączą się w ciągły pas). Postęp liczony od wejścia pola na ekran do chwili, gdy zasłoni
     hero: dolne 90% drogi. Słowa przed czołem są jawne, 7 kolejnych stoi pod belką,
     reszta czeka niewidoczna. Przy ograniczonym ruchu i bez skryptu tekst stoi w całości. */
  var redact = document.querySelector('[data-redact]');

  if (redact && !reduced) {
    var slowa = [];
    var tnij = function (node) {
      [].slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          (n.nodeValue.match(/\S+\s*|\s+/g) || []).forEach(function (t) {
            if (!/\S/.test(t)) { frag.appendChild(document.createTextNode(t)); return; }
            var s = document.createElement('span');
            s.className = 'slowo';
            s.textContent = t;
            slowa.push(s);
            frag.appendChild(s);
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1) {
          tnij(n);
        }
      });
    };
    tnij(redact);

    var FALA = 7, czolo = -1, rTick = false;
    redact.classList.add('is-redact');

    var odslon = function () {
      rTick = false;
      var vh = window.innerHeight || 1;
      var top = redact.getBoundingClientRect().top;
      // start: akapit na 95% wysokości ekranu; koniec: akapit na 25% (pole już zasłania hero)
      var p = clamp01((vh * .95 - top) / (vh * .7));
      var nowe = Math.round(p * (slowa.length + FALA));
      if (nowe === czolo) return;
      czolo = nowe;
      slowa.forEach(function (s, i) {
        var jawne = i < czolo - FALA;
        s.classList.toggle('is-jawne', jawne);
        s.classList.toggle('is-blok', !jawne && i < czolo);
      });
    };

    odslon();
    window.addEventListener('scroll', function () {
      if (!rTick) { rTick = true; window.requestAnimationFrame(odslon); }
    }, { passive: true });
    window.addEventListener('resize', odslon);
  }

  /* 8. Forma w hero: kropka ze znaku, która się rozlewa. Siedem punktów na okręgu,
     każdy z własnym, wolnym oddechem promienia; przez punkty idzie gładka krzywa
     (Catmull-Rom → Bézier). Całość powoli się obraca. Pętla działa tylko wtedy,
     gdy hero jest na ekranie. Przy ograniczonym ruchu zostaje kształt z markupu. */
  var blob = document.querySelector('[data-blob]');

  if (blob && !reduced && 'requestAnimationFrame' in window) {
    var P = 7, R = 158, CX = 200, CY = 200;
    var blobOn = true, blobRaf = 0;

    var ksztalt = function (t) {
      var pts = [], rot = t * .00005;
      for (var i = 0; i < P; i++) {
        var a = i / P * Math.PI * 2 + rot;
        var r = R * (1 + .085 * Math.sin(t * .00052 + i * 2.1) + .055 * Math.sin(t * .00089 + i * 1.3 + 1.7));
        pts.push([CX + Math.cos(a) * r, CY + Math.sin(a) * r]);
      }
      var d = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
      for (var k = 0; k < P; k++) {
        var p0 = pts[(k - 1 + P) % P], p1 = pts[k], p2 = pts[(k + 1) % P], p3 = pts[(k + 2) % P];
        d += 'C' + (p1[0] + (p2[0] - p0[0]) / 6).toFixed(1) + ' ' + (p1[1] + (p2[1] - p0[1]) / 6).toFixed(1) +
             ' ' + (p2[0] - (p3[0] - p1[0]) / 6).toFixed(1) + ' ' + (p2[1] - (p3[1] - p1[1]) / 6).toFixed(1) +
             ' ' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1);
      }
      return d + 'Z';
    };

    var krok = function (t) {
      blob.setAttribute('d', ksztalt(t));
      blobRaf = blobOn ? window.requestAnimationFrame(krok) : 0;
    };

    blobRaf = window.requestAnimationFrame(krok);

    if (hasIO) {
      new IntersectionObserver(function (entries) {
        blobOn = entries[0].isIntersecting;
        if (blobOn && !blobRaf) blobRaf = window.requestAnimationFrame(krok);
      }, { threshold: 0 }).observe(blob.closest('svg'));
    }
  }

  /* 9. Rok w nocie prawnej — żeby nie zestarzał się bez powodu. */
  var year = document.querySelector('[data-year]');
  if (year) year.textContent = new Date().getFullYear();
})();
