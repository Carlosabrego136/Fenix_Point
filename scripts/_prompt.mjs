// Preguntas por terminal. La contraseña se escribe oculta y NUNCA se imprime ni se guarda en el historial.
import readline from 'node:readline';

// Sin terminal real (p. ej. el terminal de un IDE) se lee una línea por pregunta desde la entrada estándar.
// En ese modo lo que se escribe NO se oculta: úselo solo en su propio equipo.
let lineReader = null;
const lineQueue = [];
const lineWaiters = [];
let inputClosed = false;
function nextLine() {
  if (!lineReader) {
    lineReader = readline.createInterface({ input: process.stdin, terminal: false });
    lineReader.on('line', (l) => (lineWaiters.length ? lineWaiters.shift()(l) : lineQueue.push(l)));
    lineReader.on('close', () => {
      inputClosed = true;
      while (lineWaiters.length) lineWaiters.shift()(null);
    });
  }
  if (lineQueue.length) return Promise.resolve(lineQueue.shift());
  if (inputClosed) return Promise.resolve(null);
  return new Promise((resolve) => lineWaiters.push(resolve));
}

export function ask(question, { hidden = false } = {}) {
  if (!process.stdin.isTTY) {
    process.stdout.write(question);
    return nextLine().then((line) => {
      if (line === null) throw new Error('No se recibió respuesta. Vuelva a ejecutar el comando.');
      process.stdout.write(hidden ? '(recibida)\n' : `${line}\n`);
      return line;
    });
  }
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      const out = rl;
      out._writeToOutput = (s) => {
        if (s.includes(question)) process.stdout.write(s);
        else if (s === '\r\n' || s === '\n') process.stdout.write(s);
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer);
    });
  });
}

export const USERNAME_RE = /^[a-z0-9._-]{3,30}$/;

export function passwordProblems(password) {
  const p = [];
  if (password.length < 8) p.push('mínimo 8 caracteres');
  if (password.length > 128) p.push('máximo 128 caracteres');
  if (!/[a-zA-ZáéíóúñÁÉÍÓÚÑ]/.test(password) || !/\d/.test(password)) p.push('combine letras y números');
  return p;
}

export async function askNewPassword(label) {
  for (let i = 0; i < 3; i++) {
    const a = await ask(`${label}: `, { hidden: true });
    const problems = passwordProblems(a);
    if (problems.length) {
      console.log(`  Contraseña no válida: ${problems.join(', ')}.`);
      continue;
    }
    const b = await ask('  Repita la contraseña: ', { hidden: true });
    if (a !== b) {
      console.log('  No coinciden. Intente de nuevo.');
      continue;
    }
    return a;
  }
  throw new Error('Demasiados intentos. Vuelva a ejecutar el comando.');
}
