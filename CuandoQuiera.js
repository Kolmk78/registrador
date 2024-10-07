const puppeteer = require("puppeteer");
const fs = require("fs");
const dotenv = require("dotenv");
dotenv.config();

// const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Ejecutar la función principal cada 3 minutos
const INTERVAL_TIME = 3 * 60 * 1000; // 3 minutos en milisegundos

async function main() {
  const { registros } = JSON.parse(fs.readFileSync("time.json"));

  const browser = await puppeteer.launch({
    headless: true,
  });

  console.log("Registros a registrar: ", registros);

  let arr = registros;
  let page;
  while (arr.length > 0) {
    page = await logIn(browser, page);

    let iterationsBeforeLogIn = 120 + Math.floor(Math.random() * 40 - 20);
    console.log(
      `Realizando ${iterationsBeforeLogIn} iteraciones antes de iniciar sesión...`
    );
    for (let i = 0; i < iterationsBeforeLogIn; i++) {
      arr = await register(arr, page);

      if (arr.length === 0) {
        break;
      }

      let waitingTime = (20 + Math.floor(Math.random() * 20 - 10)) * 1000;
      console.log(`Esperando ${waitingTime / 1000} segundos...`);
      await new Promise((resolve) => setTimeout(resolve, waitingTime)); //300000 = 5 minutos
    }
  }
  await browser.close();
}

// Ejecución periódica cada 3 minutos
setInterval(() => {
  main().catch((error) => console.error("Error en la ejecución del script:", error));
}, INTERVAL_TIME);

// Resto del código (register, logIn, extractNumber)

async function register(arr, page) {
  console.log("Horas solicitadas: ", arr);

  await page.goto(
    "https://intranet.upv.es/pls/soalu/sic_depact.HSemActividades?p_campus=V&p_tipoact=6799&p_codacti=21549&p_vista=intranet&p_idioma=c&p_solo_matricula_sn=&p_anc=filtro_actividad"
  );

  page.on("console", (msg) => {
    console.log(`BROWSER LOG: ${msg.text()}`);
  });

  const tableData = await page.evaluate(() => {
    const cells = Array.from(document.querySelectorAll("td")).filter((cell) =>
      cell.innerText.startsWith("MUSCULACIÓN")
    );

    return cells.map((cell) => cell.innerText.trim());
  });

  console.log("Horas ya inscritas: ", tableData);

  const musculacionNumbers = tableData.map(extractNumber);
  const musNumbers = arr.map(extractNumber);

  const differentNumbers = musNumbers.filter(
    (num) => !musculacionNumbers.includes(num)
  );

  arr = Array.from(differentNumbers.map((num) => `MUS${num}`));
  console.log("Horas no inscritas: ", arr);

  for (let i = 0; i < arr.length; i++) {
    let text = arr[i];
    let reg = await page.evaluate(async (text) => {
      const link = Array.from(document.querySelectorAll("a")).find((a) =>
        a.innerText.includes(text)
      );
      if (link) {
        link.click();
        return text;
      }
      return null;
    }, text);

    if (reg === arr[i]) {
      console.log("Registrado: ", reg);
      await page.waitForNavigation();

      arr.splice(i, 1);
      i--;
    }
  }

  return arr;
}

async function logIn(browser, pageBefore) {
  let page;
  if (!pageBefore) {
    page = await browser.newPage();
  } else {
    page = pageBefore;
  }

  await page.goto(
    "https://intranet.upv.es/pls/soalu/est_intranet.NI_Dual?P_IDIOMA=c"
  );

  const dniExists = await page.$('input[name="dni"]');
  if (dniExists) {
    console.log("Sesión caducada, iniciando sesión ...");
    await page.type('input[name="dni"]', process.env.DNI);
    await page.type('input[name="clau"]', process.env.PASSWORD);

    await page.click('input[type="submit"]');
  }
  return page;
}

const extractNumber = (str) => {
  const match = str.match(/\d+/);
  return match ? match[0] : null;
};
