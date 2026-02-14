const fileInput = document.getElementById('fileInput');
const previewImg = document.getElementById('previewImg');
const runBtn = document.getElementById('runBtn');
const status = document.getElementById('status');
const fullName = document.getElementById('fullName');
const fileInput = document.getElementById('fileInput');
const previewImg = document.getElementById('previewImg');
const runBtn = document.getElementById('runBtn');
const status = document.getElementById('status');
const fullName = document.getElementById('fullName');
const company = document.getElementById('company');
const email = document.getElementById('email');
const phone = document.getElementById('phone');
const address = document.getElementById('address');
const downloadBtn = document.getElementById('downloadBtn');
const ocrMode = document.getElementById('ocrMode');
const ocrApiKey = document.getElementById('ocrApiKey');
const phoneFormat = document.getElementById('phoneFormat');
const defaultCountry = document.getElementById('defaultCountry');

let currentImage = null;

fileInput.addEventListener('change', e=>{
  const f = e.target.files && e.target.files[0];
  if(!f) return;
  const url = URL.createObjectURL(f);
  previewImg.src = url;
  currentImage = f;
  runBtn.disabled = false;
  status.textContent = '';
});

ocrMode.addEventListener('change', ()=>{
  if(ocrMode.value === 'ocrspace'){
    ocrApiKey.style.display = 'inline-block';
  } else {
    ocrApiKey.style.display = 'none';
  }
});

runBtn.addEventListener('click', async ()=>{
  if(!currentImage) return;
  runBtn.disabled = true;
  status.textContent = 'Running OCR...';

  try{
    let text = '';
    if(ocrMode.value === 'ocrspace'){
      text = await cloudOCR(currentImage, ocrApiKey.value || '');
    } else {
      const {data: {text: t}} = await Tesseract.recognize(currentImage, 'eng', {logger:m=>{ /* console.log(m) */ }});
      text = t;
    }
    status.textContent = 'Parsing text...';
    parseAndFill(text);
    status.textContent = 'Done — review fields and download vCard.';
  }catch(err){
    console.error(err);
    status.textContent = 'OCR failed. See console.';
  } finally {
    runBtn.disabled = false;
  }
});

async function cloudOCR(file, apiKey){
  // Uses OCR.space public API. Requires API key for higher throughput.
  const form = new FormData();
  if(apiKey) form.append('apikey', apiKey);
  else form.append('apikey', 'helloworld'); // limited demo key
  form.append('language', 'eng');
  form.append('isOverlayRequired', 'false');
  form.append('file', file);

  const res = await fetch('https://api.ocr.space/parse/image', {method:'POST', body: form});
  const j = await res.json();
  if(j && j.ParsedResults && j.ParsedResults[0] && typeof j.ParsedResults[0].ParsedText === 'string'){
    return j.ParsedResults[0].ParsedText;
  }
  throw new Error('No parsed text from OCR.space');
}

function parseAndFill(raw){
  const lines = raw.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  // heuristics
  const emailRe = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
  const phoneRe = /(?:\+?\d[\d\-().\s]{5,}\d)/;

  let foundEmail = '';
  let foundPhone = '';
  let foundName = '';
  let foundCompany = '';
  let foundAddress = [];

  // find email and phone
  for(const l of lines){
    if(!foundEmail){
      const m = l.match(emailRe);
      if(m) foundEmail = m[0];
    }
    if(!foundPhone){
      const m = l.match(phoneRe);
      if(m){
        const digits = (m[0].match(/\d/g)||[]).length;
        if(digits>=7) foundPhone = m[0].trim();
      }
    }
  }

  // guess name: first line without email/phone and containing letters
  for(const l of lines){
    if(l.includes('@')||phoneRe.test(l)) continue;
    if(/[A-Za-zÄÖÜäöüß]/.test(l) && l.split(' ').length<=4){ foundName = l; break }
  }

  // guess company: a line with common suffix or all-uppercase
  const companyKeywords = ['GmbH','LLC','Ltd','AG','Inc','Company','Solutions','Gmbh','KG'];
  for(const l of lines){
    for(const kw of companyKeywords){ if(l.includes(kw)) { foundCompany = l; break } }
    if(foundCompany) break;
  }
  if(!foundCompany){
    for(const l of lines.slice(0,4)){
      if(l===l.toUpperCase() && /[A-ZÄÖÜ]{2,}/.test(l) && l.length>2){ foundCompany = l; break }
    }
  }

  // address: simple heuristic—lines containing digits or street keywords
  const addressKeywords = ['Strasse','Str.','Street','St.','Road','Rd','Lane','Ln','Ave','Avenue','Platz', 'platz'];
  for(const l of lines){
    if(/[0-9]{2,}/.test(l) || addressKeywords.some(k=>l.includes(k))){ foundAddress.push(l) }
  }

  fullName.value = foundName || '';
  company.value = foundCompany || '';
  email.value = foundEmail || '';
  phone.value = foundPhone || '';
  address.value = foundAddress.join('\n') || '';
}

function normalizePhoneNumber(raw){
  const outFmt = phoneFormat.value || 'international';
  const country = (defaultCountry.value||'DE').toUpperCase();

  const parseFn = window.parsePhoneNumberFromString || (window.libphonenumber && window.libphonenumber.parsePhoneNumberFromString) || null;
  if(parseFn){
    try{
      const p = parseFn(raw, country);
      if(p){
        if(outFmt === 'international') return p.formatInternational();
        if(outFmt === 'international00') return p.formatInternational().replace(/^\+/, '00');
        return p.formatNational();
      }
    }catch(e){ /* fall through */ }
  }

  // fallback: sanitize and try to add default country if missing
  let s = (raw||'').replace(/[()\s.-]/g,'');
  if(!s) return '';
  if(s.startsWith('00')) s = '+' + s.slice(2);
  if(!s.startsWith('+')){
    // add default country code (DE -> +49)
    const mapping = {DE: '+49'};
    s = (mapping[country]||'+49') + s.replace(/^0+/,'');
  }
  if(outFmt === 'international') return s;
  if(outFmt === 'international00') return s.replace(/^\+/, '00');
  // national: strip country code
  return s.replace(/^\+\d+/, '').replace(/^00\d+/, '');
}

function makeVCard(){
  const fn = (fullName.value||'').replace(/\n/g,' ');
  const org = company.value || '';
  const mail = email.value || '';
  const telRaw = phone.value || '';
  const tel = normalizePhoneNumber(telRaw);
  const adrRaw = (address.value||'').replace(/\n/g,';');

  const lines = [];
  lines.push('BEGIN:VCARD');
  lines.push('VERSION:3.0');
  lines.push(`FN:${escapeVcard(fn)}`);
  const parts = fn.split(' ');
  const last = parts.length>1?parts.pop():'';
  const first = parts.join(' ');
  lines.push(`N:${escapeVcard(last)};${escapeVcard(first)};;;`);
  if(org) lines.push(`ORG:${escapeVcard(org)}`);
  if(tel) lines.push(`TEL;TYPE=CELL:${escapeVcard(tel)}`);
  if(mail) lines.push(`EMAIL:${escapeVcard(mail)}`);
  if(adrRaw) lines.push(`ADR:;;${escapeVcard(adrRaw)};;;;`);
  lines.push('END:VCARD');
  return lines.join('\r\n');
}

function escapeVcard(s){ return (s||'').replace(/\r|\n/g,' ').replace(/,/g,'\\,') }

downloadBtn.addEventListener('click', ()=>{
  const v = makeVCard();
  const blob = new Blob([v],{type:'text/vcard'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const name = (fullName.value || 'contact').replace(/[^a-z0-9_-]/ig,'_');
  a.download = `${name}.vcf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});
