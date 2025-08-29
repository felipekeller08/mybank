import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

/* ===== CONFIG FIREBASE ===== */
const firebaseConfig = {
  apiKey: "AIzaSyDhD7P4n0p4reF5HHY1vx5HRxRQyG3paNA",
  authDomain: "mybank-63ff2.firebaseapp.com",
  projectId: "mybank-63ff2",
  storageBucket: "mybank-63ff2.appspot.com",
  messagingSenderId: "389173665987",
  appId: "1:389173665987:web:a86473d5a3b5bffce84276"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* ===== REFERÊNCIAS ===== */
const loginModal = document.getElementById("loginModal");
const userBtn = document.getElementById("userBtn");
const closeLogin = document.getElementById("closeLogin");
const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");
const logoutBtn = document.getElementById("logoutBtn");
const authArea = document.getElementById("authArea");
const userArea = document.getElementById("userArea");
const userEmail = document.getElementById("userEmail");
const themeToggle = document.getElementById("themeToggle");
const txHistory = document.getElementById("txHistory");

// Relatórios DOM
const alertsBox = document.getElementById("alerts");
const budgetsSummary = document.getElementById("budgetsSummary");
const budgetsList = document.getElementById("budgetsList");
const goalBox = document.getElementById("goalBox");
const topList = document.getElementById("topList");       // legado (saídas)
const topListIn = document.getElementById("topListIn");   // se existir
const topListOut = document.getElementById("topListOut"); // se existir

/* ===== THEME + SENHA ===== */
(function initTheme(){
  const saved = localStorage.getItem("mybank-theme");
  if(saved === "light"){
    document.body.classList.add("light");
    if (themeToggle) themeToggle.textContent = "☀️";
  }
})();
if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("light");
    const isLight = document.body.classList.contains("light");
    themeToggle.textContent = isLight ? "☀️" : "🌙";
    localStorage.setItem("mybank-theme", isLight ? "light" : "dark");
  });
}

const passwordInput = document.getElementById("loginPassword");
const togglePassword = document.getElementById("togglePassword");
if (togglePassword && passwordInput) {
  togglePassword.addEventListener("click", () => {
    if (passwordInput.type === "password") { passwordInput.type = "text"; togglePassword.textContent = "🙈"; }
    else { passwordInput.type = "password"; togglePassword.textContent = "👁️"; }
  });
}

/* ===== MODAL LOGIN ===== */
if (userBtn) userBtn.onclick = () => { loginModal.style.display = "flex"; loginModal.setAttribute("aria-hidden", "false"); };
if (closeLogin) closeLogin.onclick = () => { loginModal.style.display = "none"; loginModal.setAttribute("aria-hidden", "true"); };
window.addEventListener("click", (e) => { if(e.target === loginModal){ loginModal.style.display = "none"; loginModal.setAttribute("aria-hidden", "true"); }});

// Registro
if (registerBtn) {
  registerBtn.addEventListener("click", async () => {
    const email = document.getElementById("loginEmail").value.trim();
    const senha = document.getElementById("loginPassword").value;
    if(!email || !senha){ alert("Preencha email e senha."); return; }
    try{
      const cred = await createUserWithEmailAndPassword(auth, email, senha);
      await setDoc(doc(db, "users", cred.user.uid), { wallet: 0, savings: 0, transactions: [], budgets:{}, goal:null }, { merge:true });
      alert("Conta criada com sucesso!");
    }catch(err){ alert(err.message); }
  });
}
// Login
if (loginBtn) {
  loginBtn.addEventListener("click", async () => {
    const email = document.getElementById("loginEmail").value.trim();
    const senha = document.getElementById("loginPassword").value;
    if(!email || !senha){ alert("Preencha email e senha."); return; }
    try{ await signInWithEmailAndPassword(auth, email, senha); alert("Login realizado!"); }catch(err){ alert(err.message); }
  });
}
// Logout
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => { await signOut(auth); alert("Saiu da conta."); });
}

/* ===== ESTADO ===== */
let currentUserId = null;
let wallet = 0;
let savings = 0;
/** transactions: {type: "entrada"|"saida"|"save"|"withdraw", amount:number, desc:string, cat?:string, date: ISOString}[] */
let transactions = [];
/** budgets: { [cat:string]: number } */
let budgets = {};
/** goal: { target:number, deadline?: "YYYY-MM" } | null */
let goal = null;

const BRL = v => (Number(v)||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});

/* ===== AUTH ===== */
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUserId = user.uid;
    authArea.style.display = "none";
    userArea.style.display = "block";
    userEmail.textContent = user.email;
    loginModal.style.display = "none";
    loginModal.setAttribute("aria-hidden", "true");
    document.querySelectorAll(".nav-item").forEach(i=>i.classList.remove("disabled"));

    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      wallet = Number(data.wallet)||0;
      savings = Number(data.savings)||0;
      transactions = Array.isArray(data.transactions) ? data.transactions : [];
      budgets = data.budgets || {};
      goal = data.goal || null;
    } else {
      await setDoc(ref, { wallet:0, savings:0, transactions:[], budgets:{}, goal:null }, {merge:true});
      wallet=0; savings=0; transactions=[]; budgets={}; goal=null;
    }
    updateValues();
    renderTransactions();
    renderBudgetsList();
    renderGoalBox();
    updateReport();
  } else {
    currentUserId = null;
    authArea.style.display = "block";
    userArea.style.display = "none";
    loginModal.style.display = "flex";
    loginModal.setAttribute("aria-hidden", "false");
    document.querySelectorAll(".nav-item").forEach(i=>i.classList.add("disabled"));
    wallet=0; savings=0; transactions=[]; budgets={}; goal=null;
    updateValues();
    if (txHistory) txHistory.innerHTML="";
    if (alertsBox) alertsBox.innerHTML="";
    destroyCharts();
  }
});

/* ===== NAVEGAÇÃO ===== */
document.querySelectorAll(".nav-item").forEach(btn => {
  btn.addEventListener("click", () => {
    if(btn.classList.contains("disabled")) return;
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".nav-item").forEach(i => i.classList.remove("active"));
    document.getElementById(btn.dataset.tab).classList.add("active");
    btn.classList.add("active");
  });
});

/* ===== FUNÇÕES BÁSICAS ===== */
function updateValues() {
  const total = wallet + savings;
  document.getElementById("walletValue").textContent = BRL(wallet);
  document.getElementById("savingsValue").textContent = BRL(savings);
  document.getElementById("totalValue").textContent   = BRL(total);
}

function renderTransactions() {
  if (!txHistory) return;
  txHistory.innerHTML = "<h2 style='margin-top:0;color:#2a7cff'>Histórico</h2>";
  if (!transactions.length) { txHistory.innerHTML += "<p class='hint'>Nenhuma transação registrada.</p>"; return; }
  transactions.slice().reverse().forEach(tx => {
    const isEntrada = tx.type === "entrada";
    const isSaida = tx.type === "saida";
    const label = isEntrada ? "ENTRADA" : (isSaida ? "SAÍDA" : tx.type.toUpperCase());
    const cls = isEntrada ? "tx-entrada" : (isSaida ? "tx-saida" : "");
    const div = document.createElement("div");
    div.className = "tx-item";
    div.style.marginBottom = "10px";
    div.innerHTML = `
      <strong class="${cls}">${label}</strong> • ${BRL(tx.amount)} • <small>${tx.cat||"Outros"}</small>
      <br><small>${tx.desc || "Sem descrição"}</small>
      <br><small>${new Date(tx.date).toLocaleString("pt-BR")}</small>
      <hr style="border-color:var(--line)">
    `;
    txHistory.appendChild(div);
  });
}

async function saveData() {
  if (!currentUserId) return;
  const ref = doc(db, "users", currentUserId);
  await setDoc(ref, { wallet, savings, transactions, budgets, goal }, { merge:true });
}

/* ===== AÇÕES ===== */
// Salário conta como ENTRADA
window.applySalary = async function () {
  if(!currentUserId){ alert("Entre na sua conta para salvar."); return; }
  const el = document.getElementById("salaryInput");
  const salary = parseFloat((el.value||"").replace(',', '.'));
  if (!isNaN(salary) && salary > 0) {
    wallet += salary;
    transactions.push({ type:"entrada", amount:salary, desc:"Salário", cat:"Renda", date:new Date().toISOString() });
    el.value = "";
    updateValues(); renderTransactions(); await saveData(); updateReport();
    alert("Salário adicionado!");
  } else { alert("Informe um valor válido."); }
};

window.applySavings = async function () {
  if(!currentUserId){ alert("Entre na sua conta para salvar."); return; }
  const el = document.getElementById("savingsInput");
  const saved = parseFloat((el.value||"").replace(',', '.'));
  if (!isNaN(saved) && saved >= 0) {
    savings = saved; el.value = "";
    updateValues(); await saveData(); renderGoalBox();
    alert("Guardado atualizado!");
  } else { alert("Informe um valor válido."); }
};

window.addTransaction = async function () {
  if(!currentUserId){ alert("Entre na sua conta para salvar."); return; }
  const type = document.getElementById("txType").value; // "entrada" | "saida" | "save" | "withdraw"
  const catEl = document.getElementById("txCat");
  const cat = (catEl && catEl.value) ? catEl.value : "Outros";
  const amountEl = document.getElementById("txAmount");
  const descEl = document.getElementById("txDesc");
  const amount = parseFloat((amountEl.value || "0").replace(',', '.'));
  const desc = (descEl.value || "Sem descrição").trim();

  if (isNaN(amount) || amount <= 0) { alert("Informe um valor válido."); return; }

  // Regras de saldo
  if (type === "saida" && wallet - amount < 0) { alert("Saldo insuficiente na carteira."); return; }
  if (type === "save" && wallet - amount < 0) { alert("Saldo insuficiente para guardar."); return; }
  if (type === "withdraw" && savings - amount < 0) { alert("Guardado insuficiente para resgatar."); return; }

  // Aplica efeitos
  if (type === "saida")   wallet -= amount;
  if (type === "entrada") wallet += amount;
  if (type === "save")   { wallet -= amount; savings += amount; }
  if (type === "withdraw"){ savings -= amount; wallet += amount; }

  transactions.push({ type, amount:Number(amount), desc, cat, date: new Date().toISOString() });
  amountEl.value = ""; descEl.value = "";
  updateValues(); renderTransactions(); await saveData(); updateReport(); renderGoalBox();
  alert("Transação registrada!");
};

/* ===== RELATÓRIOS ===== */
let chartBar=null, chartPieIn=null, chartPieOut=null, chartLine=null;
function destroyCharts(){
  [chartBar,chartPieIn,chartPieOut,chartLine].forEach(c=>{ if(c && typeof c.destroy==="function"){ c.destroy(); } });
  chartBar=chartPieIn=chartPieOut=chartLine=null;
}
function sum(arr){ return arr.reduce((a,b)=>a+b,0); }

window.updateReport = function(){
  if (!alertsBox || !budgetsSummary) return;

  if(!transactions.length){
    alertsBox.innerHTML="";
    destroyCharts();
    budgetsSummary.innerHTML="";
    if (topList) topList.innerHTML="";
    if (topListIn) topListIn.innerHTML="";
    if (topListOut) topListOut.innerHTML="";
    return;
  }
  const monthEl = document.getElementById("reportMonth");
  const month = (monthEl && monthEl.value) ? monthEl.value : new Date().toISOString().slice(0,7);

  // Filtra mês
  const list = transactions
    .filter(tx => (tx.date||"").slice(0,7)===month)
    .sort((a,b)=>a.date.localeCompare(b.date));

  // Entradas/saídas totais
  const incomesList  = list.filter(t=>t.type==="entrada");
  const expensesList = list.filter(t=>t.type==="saida");
  const totalIn = sum(incomesList.map(t=>+t.amount));
  const totalOut = sum(expensesList.map(t=>+t.amount));

  // Agrupar por DESCRIÇÃO (para tops)
  const groupByDesc = (arr) => {
    const map = {};
    arr.forEach(t=>{
      const d = (t.desc || "Sem descrição").trim().toLowerCase();
      map[d] = (map[d]||0) + Number(t.amount||0);
    });
    return map;
  };
  const incByDesc = groupByDesc(incomesList);
  const expByDesc = groupByDesc(expensesList);

  // Top 5 — Entradas / Saídas
  const toTopListHTML = (obj) => {
    const top = Object.entries(obj).sort((a,b)=>b[1]-a[1]).slice(0,5);
    return top.length ? top.map(([d,v],i)=>`${i+1}. ${d} — <b>${BRL(v)}</b>`).join("<br>") : "Sem dados no período.";
  };
  if (topListIn)  topListIn.innerHTML  = toTopListHTML(incByDesc);
  if (topListOut) topListOut.innerHTML = toTopListHTML(expByDesc);
  if (topList && !topListOut) topList.innerHTML = toTopListHTML(expByDesc);

  // Saldo diário do mês
  const days = [...new Set(list.map(t=>t.date.slice(0,10)))].sort();
  let run = 0; const lineX=[], lineY=[];
  days.forEach(day=>{
    const sumDay = list.filter(t=>t.date.slice(0,10)===day).reduce((acc,t)=>{
      if(t.type==="entrada") acc += Number(t.amount);
      else if(t.type==="saida") acc -= Number(t.amount);
      else if(t.type==="save"){ acc -= Number(t.amount); }
      else if(t.type==="withdraw"){ acc += Number(t.amount); }
      return acc;
    },0);
    run += sumDay; lineX.push(day.slice(8)); lineY.push(run);
  });

  // Orçamentos e alertas (por categoria)
  const byCat = {};
  expensesList.forEach(t=>{
    const c = t.cat || "Outros";
    byCat[c] = (byCat[c]||0) + Number(t.amount||0);
  });

  const alerts = [];
  if(totalOut > totalIn) alerts.push(`Você gastou ${BRL(totalOut-totalIn)} a mais do que entrou neste mês.`);
  Object.entries(byCat).forEach(([cat,val])=>{
    if(budgets[cat] && val > budgets[cat]) alerts.push(`Categoria <b>${cat}</b> estourou o orçamento (${BRL(val)} / ${BRL(budgets[cat])}).`);
  });
  if(goal && goal.target){
    const pct = Math.min(100, Math.round((savings/goal.target)*100));
    const nowM = (new Date()).toISOString().slice(0,7);
    if(goal.deadline && month===nowM && pct < 50) alerts.push(`Meta de economia em ${pct}% — acelere para atingir até ${goal.deadline}.`);
  }
  alertsBox.innerHTML = alerts.map(a=>`<div class="banner warn">${a}</div>`).join("") || `<div class="banner ok">Tudo sob controle neste mês. 🎯</div>`;

  // Resumo de orçamentos
  const budHTML = Object.keys(budgets).length ? Object.entries(budgets).map(([cat,lim])=>{
    const used = byCat[cat]||0; const pct = Math.min(100, Math.round((used/lim)*100));
    return `<div style="margin:8px 0"><b>${cat}</b> — ${BRL(used)} / ${BRL(lim)} (${pct}%)
      <div class="progress"><span style="width:${pct}%"></span></div></div>`;
  }).join("") : "Nenhum orçamento definido.";
  budgetsSummary.innerHTML = budHTML;

  // Gráficos (só se Chart.js existir)
  if (typeof window.Chart === "undefined") return;
  destroyCharts();

  const ctxBarEl  = document.getElementById("chartBarInOut");
  const ctxPieIn  = document.getElementById("chartPieIncomes");   // pode não existir no HTML
  const ctxPieOut = document.getElementById("chartPieExpenses");  // EXISTE no HTML
  const ctxLineEl = document.getElementById("chartLineBalance");  // EXISTE no HTML

  // Barras: Entradas x Saídas
  if (ctxBarEl) {
    const ctxBar = ctxBarEl.getContext("2d");
    chartBar = new Chart(ctxBar,{
      type:"bar",
      data:{ labels:["Entradas","Saídas"], datasets:[{ data:[totalIn,totalOut] }] },
      options:{ responsive:true, plugins:{legend:{display:false}, tooltip:{callbacks:{ label:(c)=>BRL(c.parsed.y) }}},
                scales:{ y:{ beginAtZero:true, ticks:{ callback:v=>BRL(v) } } } }
    });
  }

  // Pizza de ENTRADAS (por descrição) — opcional
  if (ctxPieIn) {
    const labelsIn = Object.keys(incByDesc).map(s=>s || "Sem descrição");
    const dataIn   = Object.values(incByDesc).map(v=>Number(v)||0);
    const ctx = ctxPieIn.getContext("2d");
    chartPieIn = new Chart(ctx,{
      type:"pie",
      data:{ labels: labelsIn, datasets:[{ data: dataIn }] },
      options:{ responsive:true,
        elements:{ arc:{ borderWidth:2, borderColor:"rgba(255,255,255,.12)" } },
        plugins:{ legend:{position:"bottom"}, tooltip:{ callbacks:{ label:(c)=> `${c.label}: ${BRL(c.parsed)}` } } } }
    });
  }

  // Linha: saldo ao longo do mês (chartLineBalance)
  if (ctxLineEl) {
    const ctxLine = ctxLineEl.getContext("2d");
    chartLine = new Chart(ctxLine,{
      type:"line",
      data:{ labels:lineX, datasets:[{ data:lineY, tension:.3, fill:false }] },
      options:{ responsive:true, plugins:{legend:{display:false}, tooltip:{callbacks:{ label:(c)=>BRL(c.parsed.y) }}},
                scales:{ y:{ ticks:{ callback:v=>BRL(v) } } } }
    });
  }
};

/* ===== ORÇAMENTOS ===== */
window.setBudget = async function(){
  if(!currentUserId){ alert("Entre na sua conta."); return; }
  const catEl = document.getElementById("budgetCat");
  const valEl = document.getElementById("budgetValue");
  const cat = catEl ? catEl.value : "";
  const val = parseFloat((valEl && valEl.value ? valEl.value : "").replace(",",".")); 
  if(!cat || isNaN(val) || val<=0){ alert("Informe categoria e valor válido."); return; }
  budgets[cat]=val; await saveData(); renderBudgetsList(); updateReport();
};
function renderBudgetsList(){
  if(!budgetsList) return;
  if(!Object.keys(budgets).length){ budgetsList.innerHTML="Nenhum orçamento definido."; return; }
  budgetsList.innerHTML = Object.entries(budgets).map(([c,v])=>`
    <div style="display:flex;justify-content:space-between;align-items:center;margin:6px 0;border-bottom:1px dashed var(--line);padding-bottom:6px">
      <span><b>${c}</b> • ${BRL(v)}</span>
      <button class="btn danger" onclick="removeBudget('${c.replace(/'/g,"\\'")}')">Remover</button>
    </div>
  `).join("");
}
window.removeBudget = async function(cat){
  delete budgets[cat]; await saveData(); renderBudgetsList(); updateReport();
}

/* ===== META DE ECONOMIA ===== */
window.saveGoal = async function(){
  if(!currentUserId){ alert("Entre na sua conta."); return; }
  const targetEl = document.getElementById("goalTarget");
  const deadlineEl = document.getElementById("goalDeadline");
  const target = parseFloat((targetEl && targetEl.value ? targetEl.value : "").replace(",",".")); 
  const deadline = deadlineEl ? (deadlineEl.value || null) : null;
  if(isNaN(target)||target<=0){ alert("Informe um valor alvo válido."); return; }
  goal = { target, deadline }; await saveData(); renderGoalBox();
};
function renderGoalBox(){
  if(!goalBox) return;
  if(!goal){ goalBox.innerHTML="Nenhuma meta definida."; return; }
  const pct = Math.min(100, Math.round((savings/goal.target)*100));
  goalBox.innerHTML = `
    <p>Meta: <b>${BRL(goal.target)}</b> ${goal.deadline?`até <b>${goal.deadline}</b>`:""}</p>
    <p>Guardado: <b>${BRL(savings)}</b> (${pct}%)</p>
    <div class="progress"><span style="width:${pct}%"></span></div>
  `;
}

/* ===== ZERAR TUDO ===== */
window.resetAll = async function(){
  if(!currentUserId){ alert("Entre na sua conta."); return; }
  const ok = confirm("Deseja realmente apagar todos os dados (carteira, guardado, transações, orçamentos e metas)?");
  if(!ok) return;

  // Limpa estado local
  wallet = 0;
  savings = 0;
  transactions = [];
  budgets = {};
  goal = null;

  // Atualiza UI imediatamente
  updateValues();
  renderTransactions();
  renderBudgetsList();
  renderGoalBox();
  destroyCharts();
  if (alertsBox) alertsBox.innerHTML = "";
  if (topList) topList.innerHTML = "";
  if (topListIn) topListIn.innerHTML = "";
  if (topListOut) topListOut.innerHTML = "";

  // Persiste no Firestore
  try{
    const ref = doc(db, "users", currentUserId);
    await setDoc(ref, { wallet:0, savings:0, transactions:[], budgets:{}, goal:null }, { merge:true });
    updateReport();
    alert("Todos os dados foram zerados.");
  }catch(err){
    alert("Não foi possível zerar agora. Tente novamente.\n" + err.message);
  }
};
