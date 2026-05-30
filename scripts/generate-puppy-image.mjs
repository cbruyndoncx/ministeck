#!/usr/bin/env node
// Generates a 64x64 pixel art puppy PNG for the image library
import { writeFileSync } from 'fs'
import { PNG } from '/home/cb/projects/dev/ministeck/node_modules/pngjs/lib/png.js'

const W = 64, H = 64
const png = new PNG({ width: W, height: H })

function hex(h) {
  return [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16), 255]
}

const COLORS = {
  ' ': [255,255,255,255],  // white background
  'B': hex('#8B4513'),     // brown body
  'b': hex('#D2691E'),     // light brown
  'T': hex('#D2B48C'),     // tan
  'N': hex('#1a1a1a'),     // black (nose, eyes, outline)
  'W': hex('#FFFFFF'),     // white
  'P': hex('#FF9999'),     // pink (tongue, inner ear)
  'G': hex('#6B8E4E'),     // green ground
}

// 64x64 pixel art puppy (front-facing sitting dog)
const ART = [
  '                                                                ',
  '                                                                ',
  '              NNNNNN          NNNNNN                            ',
  '           NNNBBBBBBNN      NNBBBBBBNN                          ',
  '          NBBBBBBBBBBN      NBBBBBBBBBN                         ',
  '          NBBBBBBBBBBN      NBBBBBBBBBN                         ',
  '           NBBBBBBBBNN      NNBBBBBBNN                          ',
  '            NNNNNNNN          NNNNNN                            ',
  '                                                                ',
  '         NNNNNNNNNNNNNNNNNNNNNNNNNNNNNNN                        ',
  '       NNBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBNN                       ',
  '      NBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBN                      ',
  '     NBBBBBBTTTTTTTTTTTTTTTTTTTTTTBBBBBBBN                      ',
  '     NBBBBBBTTTTTTTTTTTTTTTTTTTTTTBBBBBBBN                      ',
  '    NBBBBBBBTTTTTTTTTTTTTTTTTTTTTTBBBBBBBBN                     ',
  '    NBBBBBBBTTTTTTTTTTTTTTTTTTTTTTBBBBBBBBN                     ',
  '    NBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBN                      ',
  '    NBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBN                      ',
  '     NBBBBBBNNNNTTTTTTTTTTNNNNBBBBBBBN                          ',
  '     NBBBBBBNNNNTTTTTTTTTTNNNNBBBBBBBN                          ',
  '     NBBBBBBNWWWNTTTTTTTTTNWWWNBBBBBBN                          ',
  '     NBBBBBBNWWWNTTTTTTTTTNWWWNBBBBBBN                          ',
  '     NBBBBBBNNNNTTTNNNNNNNTTTTNBBBBBBN                          ',
  '      NBBBBBBBBTTTTNNNNNNNTTTBBBBBBBBN                          ',
  '       NBBBBBBTTTTTNNNNNNNTTTTBBBBBBN                           ',
  '        NNBBBBBBTTTTTNNNTTTTTBBBBNN                             ',
  '          NNBBBBBBTTTTTTTTTTBBBBBNN                             ',
  '            NNBBBBBBTTTTTTBBBBNN                                ',
  '              NNBBBBBBTTBBBBNN                                  ',
  '                NNBBBBBBBBNN                                    ',
  '                  NNNNNNNNN         NNNNNNN                     ',
  '                  NBBBBBBBBN       NBBBBBBBN                    ',
  '                NNNBBBBBBBBBNNNNNNNBBBBBBBBBN                   ',
  '               NBBBBBBBBBBBBBBBBBBBBBBBBBBBBN                   ',
  '              NBBBBBBBBBBBBBBBBBBBBBBBBBBBBBN                   ',
  '              NBBBBBBBBBBBBBBBBBBBBBBBBBBBBBN                   ',
  '               NBBBBBBBBBBBBBBBBBBBBBBBBBBN                     ',
  '                NNNBBBBBBBBBBBBBBBBBBBBNN                       ',
  '                   NNNNBBBBBBBBBBBBNNNN                         ',
  '                       NNNNNNNNNNN                              ',
  '                                                                ',
  '  NNNNNNN                              NNNNNNN                  ',
  '  NBBBBBBN                             NBBBBBBN                 ',
  '  NBBBBBBN                             NBBBBBBN                 ',
  '  NBBBBBBN                             NBBBBBBN                 ',
  '  NBBBBBBN                             NBBBBBBN                 ',
  '  NBBBBBBN                             NBBBBBBN                 ',
  '  NBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBN                 ',
  '  NBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBN                 ',
  '   NNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNN                  ',
  '                                                                ',
  '                                                                ',
  '                                                                ',
  '                                                                ',
  '                                                                ',
  '                                                                ',
  '                                                                ',
  '                                                                ',
  '                                                                ',
  '                                                                ',
  '                                                                ',
  '                                                                ',
  '                                                                ',
  '                                                                ',
]

for (let row = 0; row < H; row++) {
  for (let col = 0; col < W; col++) {
    const ch = ART[row]?.[col] ?? ' '
    const [r, g, b, a] = COLORS[ch] ?? COLORS[' ']
    const idx = (row * W + col) * 4
    png.data[idx] = r; png.data[idx+1] = g; png.data[idx+2] = b; png.data[idx+3] = a
  }
}

const buf = PNG.sync.write(png)
writeFileSync('/home/cb/projects/dev/ministeck/public/images/puppy.png', buf)
console.log('Written puppy.png')
