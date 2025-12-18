import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { deleteDoc, getFirestore, collection, addDoc, getDocs, query, where, updateDoc, doc, orderBy, limit } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBSCWbdqMxaxLKeOvmXmy5qCMXl9qbiFh4",
  authDomain: "testpeca-d70b2.firebaseapp.com",
  projectId: "testpeca-d70b2",
  storageBucket: "testpeca-d70b2.firebasestorage.app",
  messagingSenderId: "369488579656",
  appId: "1:369488579656:web:cb0f47fa29a3e0a9a25c7d",
  measurementId: "G-CMMLHCP9K4"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Estado
window.carrinho = [];
window.itensEntrada = [];
window.boletosEntrada = [];
let subtotalVenda = 0; 
let descontoGlobal = 0; 
let idProdutoEditando = null; 
window.todosClientes = []; 
window.todosProdutos = []; 
window.todasVendas = [];

// --- FUNÇÃO MENU MOBILE ---
window.alternarMenu = () => {
    const sidebar = document.getElementById('sidebar-principal');
    const overlay = document.getElementById('overlay-menu');
    sidebar.classList.toggle('menu-aberto');
    if(sidebar.classList.contains('menu-aberto')) overlay.style.display = 'block'; else overlay.style.display = 'none';
}

// --- AUTENTICAÇÃO ---
onAuthStateChanged(auth, (user) => {
    const loginTela = document.getElementById('tela-login');
    const sidebar = document.getElementById('sidebar-principal');
    const conteudo = document.getElementById('conteudo-principal');
    const btnMenu = document.getElementById('btn-menu-mobile');
    if (user) {
        loginTela.style.display = 'none';
        if(window.innerWidth > 768) sidebar.style.display = 'flex'; else { sidebar.style.display = 'flex'; btnMenu.style.display = 'block'; }
        conteudo.style.display = 'block';
        window.mostrarTela('dashboard');
    } else {
        loginTela.style.display = 'flex'; sidebar.style.display = 'none'; conteudo.style.display = 'none'; if(btnMenu) btnMenu.style.display = 'none';
    }
});

window.fazerLogin = async () => {
    const email = document.getElementById('login-email').value;
    const senha = document.getElementById('login-senha').value;
    try { await signInWithEmailAndPassword(auth, email, senha); } 
    catch (e) { document.getElementById('msg-erro-login').innerText = "Erro: " + e.message; }
}
window.fazerLogout = async () => { if(confirm("Sair?")) await signOut(auth); }

// --- NAVEGAÇÃO ---
window.mostrarTela = (telaId) => {
    document.querySelectorAll('.tela').forEach(t => t.style.display = 'none');
    document.querySelectorAll('.sidebar button').forEach(b => b.classList.remove('active'));
    const tela = document.getElementById('tela-' + telaId);
    if(tela) tela.style.display = 'block';
    const btn = document.getElementById('btn-' + telaId);
    if(btn) btn.classList.add('active');
    
    if(window.innerWidth <= 768) { document.getElementById('sidebar-principal').classList.remove('menu-aberto'); document.getElementById('overlay-menu').style.display = 'none'; }

    // CARREGAMENTOS ESPECÍFICOS
    if(telaId === 'vendas') { 
        document.getElementById('pdv-busca').focus(); 
        window.carregarClientes(); 
        window.carregarEstoque(); 
    }
    if(telaId === 'cadastro' || telaId === 'entrada') window.carregarEstoque();
    if(telaId === 'historico') window.carregarHistorico('vendas');
    if(telaId === 'clientes') window.carregarClientes();
    if(telaId === 'dashboard') window.carregarDashboard();
    if(telaId === 'financeiro') window.carregarContasPagar();
}

// ==========================================
// NOVA FUNÇÃO: Alternar Peça / Serviço
// ==========================================
window.alternarCamposCadastro = () => {
    const tipo = document.querySelector('input[name="tipo_produto"]:checked').value;
    const camposPeca = document.querySelectorAll('.campo-peca');
    
    camposPeca.forEach(div => {
        if(tipo === 'servico') {
            div.style.display = 'none';
        } else {
            div.style.display = 'block'; // ou 'flex' se o form-group original for flex, mas block é o padrão da div
        }
    });
}


// ==========================================
// CONTAS A PAGAR
// ==========================================
window.carregarContasPagar = async () => {
    const tbody = document.getElementById('lista-contas-pagar');
    tbody.innerHTML = "<tr><td colspan='6'>Carregando...</td></tr>";
    try {
        const q = query(collection(db, "contas_pagar"), orderBy("vencimento", "asc"));
        const snapshot = await getDocs(q);
        tbody.innerHTML = "";
        if(snapshot.empty) { tbody.innerHTML = "<tr><td colspan='6'>Nenhuma conta pendente.</td></tr>"; return; }
        snapshot.forEach(doc => {
            const c = doc.data();
            const venc = c.vencimento?.toDate ? c.vencimento.toDate().toLocaleDateString('pt-BR') : "--";
            let statusBadge = `<span class="badge badge-red">PENDENTE</span>`;
            let acaoBtn = `<button class="btn-whatsapp" onclick="darBaixaConta('${doc.id}')" title="Pagar"><span class="material-icons">check</span></button>`;
            if(c.status === 'pago') { statusBadge = `<span class="badge badge-green">PAGO</span>`; acaoBtn = ""; }
            tbody.innerHTML += `<tr><td>${venc}</td><td>${c.fornecedor}</td><td>${c.n_documento || '-'}</td><td>R$ ${c.valor.toFixed(2)}</td><td>${statusBadge}</td><td>${acaoBtn}<button class="btn-secondary" style="color:red" onclick="excluirConta('${doc.id}')"><span class="material-icons">delete</span></button></td></tr>`;
        });
    } catch(e) { console.error(e); }
}

window.salvarContaManual = async () => {
    try {
        const forn = document.getElementById('pagar-fornecedor').value;
        const docN = document.getElementById('pagar-doc').value;
        const venc = document.getElementById('pagar-venc').value;
        const val = parseFloat(document.getElementById('pagar-valor').value);
        if(!forn || !val || !venc) { alert("Preencha fornecedor, valor e vencimento."); return; }
        await addDoc(collection(db, "contas_pagar"), { fornecedor: forn, n_documento: docN, vencimento: new Date(venc + "T12:00:00"), valor: val, status: "pendente" });
        alert("Conta adicionada!"); document.getElementById('pagar-fornecedor').value = ""; document.getElementById('pagar-doc').value = ""; document.getElementById('pagar-valor').value = ""; window.carregarContasPagar();
    } catch(e) { alert(e.message); }
}
window.darBaixaConta = async (id) => { if(confirm("Confirmar pagamento desta conta?")) { await updateDoc(doc(db, "contas_pagar", id), { status: "pago", data_pagamento: new Date() }); window.carregarContasPagar(); } }
window.excluirConta = async (id) => { if(confirm("Excluir registro?")) { await deleteDoc(doc(db, "contas_pagar", id)); window.carregarContasPagar(); } }

// ==========================================
// IMPORTAÇÃO XML
// ==========================================
window.importarXML = (input) => {
    const file = input.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        const parser = new DOMParser();
        const xml = parser.parseFromString(e.target.result, "text/xml");
        const nNF = xml.querySelector('nNF')?.textContent || '';
        const dhEmi = xml.querySelector('dhEmi')?.textContent || '';
        const xNome = xml.querySelector('emit > xNome')?.textContent || '';
        document.getElementById('ent-nota').value = nNF;
        document.getElementById('ent-fornecedor').value = xNome;
        if(dhEmi) document.getElementById('ent-data').value = dhEmi.split('T')[0];
        const dets = xml.querySelectorAll('det');
        window.itensEntrada = [];
        for (const det of dets) {
            const prod = det.querySelector('prod');
            const cEAN = prod.querySelector('cEAN')?.textContent;   
            const cProd = prod.querySelector('cProd')?.textContent;
            const xProd = prod.querySelector('xProd')?.textContent; 
            const qCom = parseFloat(prod.querySelector('qCom')?.textContent); 
            const vUnCom = parseFloat(prod.querySelector('vUnCom')?.textContent); 
            let produtoEncontrado = window.todosProdutos.find(p => p.codigo_barras === cEAN && cEAN !== "SEM GTIN") || window.todosProdutos.find(p => p.codigo_oem === cProd);
            window.itensEntrada.push({ id: produtoEncontrado ? produtoEncontrado.id : null, codigo: cEAN !== "SEM GTIN" ? cEAN : cProd, nome: xProd, qtd: qCom, custo: vUnCom, novo: !produtoEncontrado, tipo: 'peca' });
        }
        window.atualizarTabelaEntrada();
        window.boletosEntrada = [];
        const dups = xml.querySelectorAll('dup');
        const listaBoletos = document.getElementById('lista-boletos-xml');
        const divFinanceiro = document.getElementById('area-financeira-entrada');
        if(dups.length > 0) {
            listaBoletos.innerHTML = ""; divFinanceiro.style.display = "block";
            dups.forEach(dup => {
                const nDup = dup.querySelector('nDup')?.textContent;
                const dVenc = dup.querySelector('dVenc')?.textContent;
                const vDup = parseFloat(dup.querySelector('vDup')?.textContent);
                window.boletosEntrada.push({ nDup, dVenc, vDup });
                listaBoletos.innerHTML += `<li>📄 Boleto ${nDup} - Venc: <strong>${dVenc.split('-').reverse().join('/')}</strong> - R$ ${vDup.toFixed(2)}</li>`;
            });
        } else { divFinanceiro.style.display = "none"; }
        alert(`XML Lido! ${dets.length} produtos e ${dups.length} boletos encontrados.`);
    };
    reader.readAsText(file);
}

window.filtrarProdutosEntrada = () => {
    const termo = document.getElementById('busca-entrada').value.toLowerCase();
    const divSugestao = document.getElementById('sugestoes-entrada');
    divSugestao.innerHTML = "";
    if(termo.length < 2) { divSugestao.style.display = 'none'; return; }
    const filtrados = window.todosProdutos.filter(p => p.nome.toLowerCase().includes(termo) || (p.codigo_barras && p.codigo_barras.includes(termo))).slice(0, 5); 
    if(filtrados.length > 0) {
        divSugestao.style.display = 'block';
        filtrados.forEach(p => {
            const div = document.createElement('div');
            div.style.padding = "10px"; div.style.cursor = "pointer"; div.style.borderBottom = "1px solid #eee"; div.style.background = "white";
            div.innerHTML = `<strong>${p.nome}</strong> - Estoque: ${p.estoque_atual}`;
            div.onclick = () => {
                document.getElementById('ent-prod-nome').value = p.nome;
                document.getElementById('ent-prod-id').value = p.id;
                document.getElementById('ent-prod-custo').value = p.preco_custo || 0;
                document.getElementById('ent-prod-qtd').focus();
                divSugestao.style.display = 'none';
                document.getElementById('busca-entrada').value = "";
            };
            divSugestao.appendChild(div);
        });
    } else { divSugestao.style.display = 'none'; }
}
window.adicionarItemEntrada = () => {
    const id = document.getElementById('ent-prod-id').value;
    const nome = document.getElementById('ent-prod-nome').value;
    const qtd = parseFloat(document.getElementById('ent-prod-qtd').value);
    const custo = parseFloat(document.getElementById('ent-prod-custo').value);
    if(!id || !qtd) { alert("Dados incompletos."); return; }
    window.itensEntrada.push({ id: id, codigo: "-", nome: nome, qtd: qtd, custo: custo, novo: false, tipo: 'peca' });
    window.atualizarTabelaEntrada();
}
window.atualizarTabelaEntrada = () => {
    const tbody = document.getElementById('tabela-entrada');
    tbody.innerHTML = "";
    let total = 0;
    window.itensEntrada.forEach((item, index) => {
        total += item.qtd * item.custo;
        const style = item.novo ? 'color:red; font-weight:bold;' : '';
        tbody.innerHTML += `<tr style="${style}"><td>${item.codigo}</td><td>${item.nome}</td><td>${item.qtd}</td><td>${item.custo.toFixed(2)}</td><td>${(item.qtd*item.custo).toFixed(2)}</td><td><button onclick="removerItemEntrada(${index})" class="btn-secondary" style="color:red">X</button></td></tr>`;
    });
    document.getElementById('ent-total').innerText = total.toFixed(2);
}
window.removerItemEntrada = (index) => { window.itensEntrada.splice(index, 1); window.atualizarTabelaEntrada(); }

window.salvarEntrada = async () => {
    if(window.itensEntrada.length === 0) return;
    if(!confirm("Confirmar entrada e gerar contas a pagar?")) return;
    try {
        const nota = document.getElementById('ent-nota').value;
        const fornecedor = document.getElementById('ent-fornecedor').value;
        for(const item of window.itensEntrada) {
            if(item.novo) {
                await addDoc(collection(db, "produtos"), {
                    nome: item.nome, codigo_barras: item.codigo, preco_custo: item.custo, preco: item.custo * 1.6, 
                    estoque_atual: item.qtd, estoque_minimo: 5, fornecedor: fornecedor, tipo: 'peca'
                });
            } else {
                const prodRef = doc(db, "produtos", item.id);
                const atual = window.todosProdutos.find(p => p.id === item.id)?.estoque_atual || 0;
                await updateDoc(prodRef, { estoque_atual: atual + item.qtd, preco_custo: item.custo });
            }
        }
        await addDoc(collection(db, "entradas"), { data: new Date(), nota: nota, fornecedor: fornecedor, total: parseFloat(document.getElementById('ent-total').innerText), itens: window.itensEntrada });
        for(const boleto of window.boletosEntrada) {
            await addDoc(collection(db, "contas_pagar"), {
                fornecedor: fornecedor, nota: nota, n_documento: boleto.nDup, vencimento: new Date(boleto.dVenc + "T12:00:00"), valor: boleto.vDup, status: "pendente"
            });
        }
        alert("Sucesso!"); window.itensEntrada = []; window.boletosEntrada = []; window.atualizarTabelaEntrada(); document.getElementById('ent-nota').value = ""; window.carregarEstoque();
    } catch(e) { alert("Erro: " + e.message); }
}

// --- CLIENTES ---
window.carregarClientes = async () => {
    const tbody = document.getElementById('lista-clientes');
    const selectPdv = document.getElementById('pdv-cliente-select');
    try {
        const q = query(collection(db, "clientes"), orderBy("nome"));
        const querySnapshot = await getDocs(q);
        window.todosClientes = [];
        if(selectPdv) selectPdv.innerHTML = '<option value="consumidor">Consumidor Final</option>';
        querySnapshot.forEach((doc) => {
            const c = { id: doc.id, ...doc.data() };
            window.todosClientes.push(c);
            if(selectPdv) selectPdv.innerHTML += `<option value="${c.nome}|${doc.id}">${c.nome}</option>`;
        });
        if(tbody) window.filtrarClientes();
    } catch (e) { console.error(e); }
}

window.salvarCliente = async() => {
    try {
        const dados = { 
            nome: document.getElementById('cli-nome').value, 
            telefone: document.getElementById('cli-fone').value, 
            documento: document.getElementById('cli-doc').value, 
            email: document.getElementById('cli-email').value,
            cep: document.getElementById('cli-cep').value,
            endereco: document.getElementById('cli-endereco').value,
            carro_modelo: document.getElementById('cli-carro').value,
            carro_placa: document.getElementById('cli-placa').value,
            carro_ano: document.getElementById('cli-ano').value
        };
        await addDoc(collection(db, "clientes"), dados); 
        alert("Salvo!"); 
        document.querySelectorAll('#tela-clientes input').forEach(i => i.value = ""); 
        window.carregarClientes();
    } catch(e) { alert(e.message); }
}

window.filtrarClientes = () => {
    const termo = document.getElementById('busca-clientes').value.toLowerCase();
    const tbody = document.getElementById('lista-clientes');
    tbody.innerHTML = "";
    const filtrados = window.todosClientes.filter(c => c.nome.toLowerCase().includes(termo));
    filtrados.forEach(c => { 
        tbody.innerHTML += `
            <tr>
                <td><strong>${c.nome}</strong><br><small>${c.email || ''}</small></td>
                <td>${c.telefone||'-'}</td>
                <td>${c.carro_modelo || '-'} (${c.carro_placa || ''})</td>
                <td><button class="btn-secondary" style="color:red" onclick="excluirCliente('${c.id}')">X</button></td>
            </tr>`; 
    });
}
window.filtrarClientesPDV = () => {
    const termo = document.getElementById('pdv-busca-cliente').value.toLowerCase();
    const selectPdv = document.getElementById('pdv-cliente-select');
    selectPdv.innerHTML = '<option value="consumidor">Consumidor Final</option>';
    const filtrados = window.todosClientes.filter(c => c.nome.toLowerCase().includes(termo));
    filtrados.forEach(c => { selectPdv.innerHTML += `<option value="${c.nome}|${c.id}">${c.nome}</option>`; });
}
window.excluirCliente = async(id) => { if(confirm("Excluir?")) { await deleteDoc(doc(db,"clientes",id)); window.carregarClientes(); } }

// --- DASHBOARD ---
window.carregarDashboard = async () => {
    try {
        const hojeInicio = new Date(); hojeInicio.setHours(0,0,0,0);
        const hojeFim = new Date(); hojeFim.setHours(23,59,59,999);
        const qVendas = query(collection(db, "vendas"), where("data", ">=", hojeInicio), where("data", "<=", hojeFim));
        const snapVendas = await getDocs(qVendas);
        let totalHoje = 0, qtdHoje = 0;
        snapVendas.forEach(doc => { if(doc.data().status !== 'pendente') totalHoje += doc.data().total; qtdHoje++; });
        document.getElementById('dash-total').innerText = totalHoje.toFixed(2);
        document.getElementById('dash-qtd').innerText = qtdHoje;

        const qReceber = query(collection(db, "vendas"), where("status", "==", "pendente"));
        const snapReceber = await getDocs(qReceber);
        let totalReceber = 0;
        const listaCobranca = document.getElementById('lista-cobranca');
        listaCobranca.innerHTML = "";
        snapReceber.forEach(doc => {
            const v = doc.data();
            totalReceber += v.total;
            let venc = v.vencimento?.toDate ? v.vencimento.toDate().toLocaleDateString('pt-BR') : "?";
            listaCobranca.innerHTML += `<tr><td>${venc}</td><td>${v.cliente}</td><td>R$ ${v.total.toFixed(2)}</td><td><button class="btn-whatsapp" onclick="cobrarZap('${v.cliente}','${v.total}')">Cobrar</button></td></tr>`;
        });
        document.getElementById('dash-receber').innerText = totalReceber.toFixed(2);
        document.getElementById('dash-qtd-receber').innerText = snapReceber.size;

        const qPagar = query(collection(db, "contas_pagar"), where("status", "==", "pendente"));
        const snapPagar = await getDocs(qPagar);
        let totalPagar = 0;
        snapPagar.forEach(doc => { totalPagar += doc.data().valor; });
        document.getElementById('dash-pagar').innerText = totalPagar.toFixed(2);
        document.getElementById('dash-qtd-pagar').innerText = snapPagar.size;

    } catch(e) { console.error("Erro dashboard:", e); }
}

window.carregarEstoque = async () => {
    const tbody = document.getElementById('lista-produtos-estoque');
    try {
        const q = query(collection(db, "produtos"), orderBy("nome"));
        const querySnapshot = await getDocs(q);
        window.todosProdutos = []; 
        querySnapshot.forEach((doc) => { window.todosProdutos.push({ id: doc.id, ...doc.data() }); });
        if(tbody) window.filtrarEstoque(); 
    } catch (e) { console.error(e); }
}
window.filtrarEstoque = () => {
    const termo = document.getElementById('busca-estoque').value.toLowerCase();
    const tbody = document.getElementById('lista-produtos-estoque');
    if(!tbody) return;
    tbody.innerHTML = "";
    const filtrados = window.todosProdutos.filter(p => p.nome.toLowerCase().includes(termo) || (p.codigo_barras && p.codigo_barras.includes(termo)));
    filtrados.forEach(p => {
        const dadosJson = encodeURIComponent(JSON.stringify(p));
        const isServico = (p.tipo === 'servico');
        const estoqueDisplay = isServico ? '<span class="badge badge-green">SERVIÇO</span>' : p.estoque_atual;
        tbody.innerHTML += `<tr><td><strong>${p.nome}</strong><br><small>${isServico ? 'MÃO DE OBRA' : p.codigo_barras}</small></td><td>R$ ${p.preco.toFixed(2)}</td><td>${estoqueDisplay}</td><td><button onclick="prepararEdicao('${p.id}', '${dadosJson}')" class="btn-secondary">✏️</button><button onclick="excluirProduto('${p.id}')" class="btn-secondary" style="color:red">🗑️</button></td></tr>`;
    });
}
window.salvarProduto = async () => {
    try {
        // Verifica o tipo selecionado no radio button
        const tipoSelecionado = document.querySelector('input[name="tipo_produto"]:checked').value;
        const isServico = (tipoSelecionado === 'servico');

        const dados = {
            tipo: tipoSelecionado,
            nome: document.getElementById('cad-nome').value, 
            preco: parseFloat(document.getElementById('cad-preco').value) || 0, 
            preco_custo: parseFloat(document.getElementById('cad-custo').value) || 0,
            carros_compativeis: document.getElementById('cad-carros').value, 
            // Campos que só importam para Peças (mas salvamos vazio se for serviço)
            codigo_barras: isServico ? "SERV-" + Date.now() : (document.getElementById('cad-codigo').value || "SEM GTIN"), 
            codigo_oem: isServico ? "" : document.getElementById('cad-oem').value, 
            marca: isServico ? "" : document.getElementById('cad-marca').value,
            estoque_atual: isServico ? 9999 : (parseInt(document.getElementById('cad-estoque').value) || 0), 
            estoque_minimo: isServico ? 0 : (parseInt(document.getElementById('cad-minimo').value) || 0), 
            localizacao: isServico ? "" : document.getElementById('cad-local').value, 
            fornecedor: isServico ? "" : document.getElementById('cad-fornecedor').value
        };

        if(idProdutoEditando) { await updateDoc(doc(db, "produtos", idProdutoEditando), dados); idProdutoEditando = null; } 
        else { await addDoc(collection(db, "produtos"), dados); }
        alert("Salvo!"); document.querySelectorAll('#tela-cadastro input').forEach(i => i.value = ""); window.carregarEstoque();
    } catch(e) { alert(e.message); }
}
window.prepararEdicao = (id, dadosJson) => {
    const p = JSON.parse(decodeURIComponent(dadosJson)); idProdutoEditando = id;
    
    // Configura o tipo (Peça ou Serviço)
    const isServico = (p.tipo === 'servico');
    if(isServico) document.querySelector('input[name="tipo_produto"][value="servico"]').checked = true;
    else document.querySelector('input[name="tipo_produto"][value="peca"]').checked = true;
    window.alternarCamposCadastro();

    document.getElementById('cad-nome').value = p.nome || ""; 
    document.getElementById('cad-preco').value = p.preco || ""; 
    document.getElementById('cad-custo').value = p.preco_custo || "";
    document.getElementById('cad-carros').value = p.carros_compativeis || "";

    if(!isServico) {
        document.getElementById('cad-codigo').value = p.codigo_barras || ""; 
        document.getElementById('cad-oem').value = p.codigo_oem || "";
        document.getElementById('cad-marca').value = p.marca || "";
        document.getElementById('cad-estoque').value = p.estoque_atual || "";
        document.getElementById('cad-minimo').value = p.estoque_minimo || "";
        document.getElementById('cad-local').value = p.localizacao || "";
        document.getElementById('cad-fornecedor').value = p.fornecedor || "";
    }

    document.querySelector('.content').scrollTop = 0;
}
window.excluirProduto = async(id) => { if(confirm("Excluir?")) { await deleteDoc(doc(db,"produtos",id)); window.carregarEstoque(); } }

window.carregarHistorico = async (tipo) => {
    const tbody = document.getElementById('lista-historico'); const thead = document.getElementById('head-historico'); if(!tbody) return;
    tbody.innerHTML = "<tr><td colspan='5'>Carregando...</td></tr>";
    try {
        let q;
        if(tipo === 'vendas') { thead.innerHTML = `<tr><th>Data</th><th>Cliente</th><th>Status</th><th>Total</th><th>Ação</th></tr>`; q = query(collection(db, "vendas"), orderBy("data", "desc"), limit(50)); } 
        else { thead.innerHTML = `<tr><th>Data</th><th>Fornecedor</th><th>Nota</th><th>Total</th><th>Ação</th></tr>`; q = query(collection(db, "entradas"), orderBy("data", "desc"), limit(50)); }
        const querySnapshot = await getDocs(q); window.todasVendas = []; tbody.innerHTML = "";
        querySnapshot.forEach((doc) => {
            const data = doc.data(); window.todasVendas.push({ id: doc.id, ...data, tipo: tipo });
            let dataFormatada = data.data?.toDate ? data.data.toDate().toLocaleString('pt-BR') : "--";
            if(tipo === 'vendas') {
                let badge = data.status === 'pendente' ? `<span class="badge badge-red">PENDENTE</span>` : `<span class="badge badge-green">PAGO</span>`;
                const jsonVenda = encodeURIComponent(JSON.stringify({id: doc.id, ...data}));
                tbody.innerHTML += `
                    <tr>
                        <td>${dataFormatada}</td><td>${data.cliente}</td><td>${badge}</td><td>R$ ${data.total.toFixed(2)}</td>
                        <td style="display:flex; gap:5px;">
                            <button onclick="verDetalhesVenda('${jsonVenda}')" class="btn-secondary">Ver</button>
                            <button onclick="excluirVenda('${doc.id}')" class="btn-secondary" style="color:red;"><span class="material-icons">delete</span></button>
                        </td>
                    </tr>`;
            } else { 
                tbody.innerHTML += `
                    <tr>
                        <td>${dataFormatada}</td><td>${data.fornecedor}</td><td>${data.nota}</td><td>R$ ${data.total?.toFixed(2)||'0.00'}</td>
                        <td style="display:flex; gap:5px;">
                            <small>${data.itens.length} itens</small>
                            <button onclick="excluirEntrada('${doc.id}')" class="btn-secondary" style="color:red;"><span class="material-icons">delete</span></button>
                        </td>
                    </tr>`; 
            }
        });
        document.getElementById('busca-historico').dataset.tipo = tipo;
    } catch (e) { console.error(e); }
}

window.filtrarHistorico = () => {
    const termo = document.getElementById('busca-historico').value.toLowerCase(); const tipo = document.getElementById('busca-historico').dataset.tipo || 'vendas';
    const tbody = document.getElementById('lista-historico'); tbody.innerHTML = "";
    const filtrados = window.todasVendas.filter(v => v.tipo === tipo && (JSON.stringify(v).toLowerCase().includes(termo)));
    filtrados.forEach(data => {
        let dataFormatada = data.data?.toDate ? data.data.toDate().toLocaleString('pt-BR') : "--";
        if(tipo === 'vendas') {
            let badge = data.status === 'pendente' ? `<span class="badge badge-red">PENDENTE</span>` : `<span class="badge badge-green">PAGO</span>`;
            const jsonVenda = encodeURIComponent(JSON.stringify(data));
            tbody.innerHTML += `<tr><td>${dataFormatada}</td><td>${data.cliente}</td><td>${badge}</td><td>R$ ${data.total.toFixed(2)}</td><td style="display:flex; gap:5px;"><button onclick="verDetalhesVenda('${jsonVenda}')" class="btn-secondary">Ver</button><button onclick="excluirVenda('${data.id}')" class="btn-secondary" style="color:red;"><span class="material-icons">delete</span></button></td></tr>`;
        } else { 
            tbody.innerHTML += `<tr><td>${dataFormatada}</td><td>${data.fornecedor}</td><td>${data.nota}</td><td>R$ ${data.total?.toFixed(2)||'0.00'}</td><td style="display:flex; gap:5px;"><small>${data.itens.length} itens</small><button onclick="excluirEntrada('${data.id}')" class="btn-secondary" style="color:red;"><span class="material-icons">delete</span></button></td></tr>`; 
        }
    });
}

window.excluirVenda = async (id) => {
    if(confirm("Tem certeza que deseja excluir esta venda do histórico?")) {
        try { await deleteDoc(doc(db, "vendas", id)); window.carregarHistorico('vendas'); }
        catch(e) { alert("Erro ao excluir: " + e.message); }
    }
}

window.excluirEntrada = async (id) => {
    if(confirm("Tem certeza que deseja excluir esta entrada?")) {
        try { await deleteDoc(doc(db, "entradas", id)); window.carregarHistorico('entradas'); }
        catch(e) { alert("Erro ao excluir: " + e.message); }
    }
}

window.verDetalhesVenda = (jsonVenda) => {
    const venda = JSON.parse(decodeURIComponent(jsonVenda));
    let msg = `CLIENTE: ${venda.cliente}\nITENS:\n`;
    venda.itens.forEach(i => msg += `- ${i.qtd}x ${i.nome} | R$ ${(i.preco).toFixed(2)}\n`);
    msg += `\nTOTAL: R$ ${venda.total.toFixed(2)}`;
    alert(msg);
}
window.cobrarZap = (cliente, valor) => { window.open(`https://wa.me/?text=Olá ${cliente}, lembrete de pagamento R$ ${valor}`, '_blank'); }
window.gerarRelatorio = async () => {
    const tbody = document.querySelector('#tabela-relatorio tbody'); tbody.innerHTML = "Carregando...";
    try {
        const q = await getDocs(collection(db, "produtos")); tbody.innerHTML = "";
        q.forEach((doc) => { const p = doc.data(); if (p.estoque_atual <= p.estoque_minimo && p.tipo !== 'servico') tbody.innerHTML += `<tr><td>${p.nome}</td><td>${p.localizacao||'-'}</td><td>${p.estoque_atual}</td><td>${p.estoque_minimo}</td><td style="color:red; font-weight:bold">REPOR</td></tr>`; });
    } catch (e) { console.error(e); }
}

const inputBusca = document.getElementById('pdv-busca');
if(inputBusca) {
    inputBusca.addEventListener('keydown', async (event) => {
        if (event.key === 'Enter') {
            const termo = inputBusca.value;
            // 1. Tenta buscar código exato no banco (Prioridade Máxima)
            let q = query(collection(db, "produtos"), where("codigo_barras", "==", termo));
            let querySnapshot = await getDocs(q);
            if(querySnapshot.empty) { q = query(collection(db, "produtos"), where("codigo_oem", "==", termo)); querySnapshot = await getDocs(q); }
            
            if (!querySnapshot.empty) {
                // Achou código exato
                querySnapshot.forEach((doc) => { adicionarAoCarrinho(doc.id, doc.data()); });
                inputBusca.value = "";
                document.getElementById('sugestoes-pdv').style.display = 'none';
                feedbackVisual('sucesso');
            } else {
                // 2. Se não achou código, tenta achar nome exato na memória
                const matchNome = window.todosProdutos.find(p => p.nome.toLowerCase() === termo.toLowerCase());
                if(matchNome) {
                    adicionarAoCarrinho(matchNome.id, matchNome);
                    inputBusca.value = "";
                    document.getElementById('sugestoes-pdv').style.display = 'none';
                    feedbackVisual('sucesso');
                } else {
                    document.getElementById('status-busca').innerText = "Não encontrado!"; 
                    feedbackVisual('erro');
                }
            }
        }
    });
}

window.filtrarProdutosPDV = () => {
    const termo = document.getElementById('pdv-busca').value.toLowerCase();
    const divSugestao = document.getElementById('sugestoes-pdv');
    divSugestao.innerHTML = "";
    
    if(termo.length < 2) { 
        divSugestao.style.display = 'none'; 
        return; 
    }

    // Filtra no cache local (window.todosProdutos)
    const filtrados = window.todosProdutos.filter(p => 
        p.nome.toLowerCase().includes(termo) || 
        (p.codigo_barras && p.codigo_barras.includes(termo)) || 
        (p.codigo_oem && p.codigo_oem.includes(termo))
    ).slice(0, 8); 

    if(filtrados.length > 0) {
        divSugestao.style.display = 'block';
        filtrados.forEach(p => {
            const isServico = (p.tipo === 'servico');
            const div = document.createElement('div');
            const subtexto = isServico ? "🔧 SERVIÇO / MÃO DE OBRA" : `${p.codigo_barras} | R$ ${p.preco.toFixed(2)}`;
            div.innerHTML = `<strong>${p.nome}</strong> <br> <small style="color:#666">${subtexto}</small>`;
            div.onclick = () => {
                window.adicionarAoCarrinho(p.id, p); 
                document.getElementById('pdv-busca').value = "";
                divSugestao.style.display = 'none';
                document.getElementById('pdv-busca').focus();
            };
            divSugestao.appendChild(div);
        });
    } else {
        divSugestao.style.display = 'none';
    }
}

window.adicionarAoCarrinho = (id, produto) => {
    const isServico = (produto.tipo === 'servico');
    if (!isServico && produto.estoque_atual <= 0) alert("ALERTA: Produto sem estoque físico!");
    window.carrinho.push({ id, ...produto, qtd: 1 });
    window.atualizarTabela();
}

window.atualizarTabela = () => {
    const tbody = document.getElementById('tabela-carrinho');
    tbody.innerHTML = "";
    subtotalVenda = 0;
    window.carrinho.forEach((item, index) => {
        const totalItem = item.preco * item.qtd;
        subtotalVenda += totalItem;
        tbody.innerHTML += `
            <tr style="display: grid; grid-template-columns: 2fr 1fr 1fr 0.5fr; align-items: center;">
                <td><strong>${item.nome}</strong><br><small>${item.marca || ''}</small></td>
                <td><input type="number" min="1" value="${item.qtd}" onchange="atualizarQtd(${index}, this.value)" style="width: 60px; padding: 5px; text-align: center;"></td>
                <td>R$ ${totalItem.toFixed(2)}</td>
                <td style="text-align:right;"><button onclick="removerItem(${index})" style="color:#ef4444; background:none; border:none; cursor:pointer;"><span class="material-icons">delete</span></button></td>
            </tr>`;
    });
    document.getElementById('info-subtotal').innerText = `Subtotal: R$ ${subtotalVenda.toFixed(2)}`;
    const totalFinal = subtotalVenda - descontoGlobal;
    const inputTotal = document.getElementById('valor-total-input');
    if(document.activeElement !== inputTotal) inputTotal.value = totalFinal.toFixed(2);
}

window.recalcularDescontoPeloTotal = () => {
    const inputTotal = document.getElementById('valor-total-input');
    const novoTotal = parseFloat(inputTotal.value) || 0;
    if(novoTotal < subtotalVenda) descontoGlobal = subtotalVenda - novoTotal; else descontoGlobal = 0;
    inputTotal.value = novoTotal.toFixed(2);
}

window.atualizarQtd = (index, novaQtd) => {
    const qtd = parseInt(novaQtd);
    if(qtd > 0) { window.carrinho[index].qtd = qtd; window.atualizarTabela(); }
}
window.removerItem = (index) => { window.carrinho.splice(index, 1); window.atualizarTabela(); }

window.finalizarVenda = async () => {
    if(window.carrinho.length === 0) return;
    window.recalcularDescontoPeloTotal();
    const totalFinal = subtotalVenda - descontoGlobal;
    if(!confirm(`Confirmar venda de R$ ${totalFinal.toFixed(2)}?`)) return;

    try {
        const clienteSelect = document.getElementById('pdv-cliente-select').value;
        let nomeCliente = "Consumidor Final";
        if(clienteSelect !== "consumidor") nomeCliente = clienteSelect.split('|')[0];
        
        const formaPagamento = document.getElementById('pdv-forma-pagamento').value;
        let dataVencimento = null;
        let statusVenda = "pago";
        if(formaPagamento === "prazo") {
            statusVenda = "pendente";
            const hoje = new Date();
            hoje.setDate(hoje.getDate() + 30);
            dataVencimento = hoje;
        }

        await addDoc(collection(db, "vendas"), {
            data: new Date(), subtotal: subtotalVenda, desconto: descontoGlobal, total: totalFinal,
            cliente: nomeCliente, forma_pagamento: formaPagamento, status: statusVenda, vencimento: dataVencimento, itens: window.carrinho
        });

        // Só atualiza estoque se NÃO for serviço
        for (const item of window.carrinho) {
            if(item.tipo !== 'servico') {
                const itemRef = doc(db, "produtos", item.id);
                const atual = window.todosProdutos.find(p => p.id === item.id)?.estoque_atual || 0;
                await updateDoc(itemRef, { estoque_atual: atual - item.qtd });
            }
        }

        if(confirm("Deseja imprimir?")) window.imprimirCupom(nomeCliente, window.carrinho, totalFinal, descontoGlobal, new Date(), dataVencimento);
        alert("Venda Sucesso!");
        window.carrinho = []; subtotalVenda = 0; descontoGlobal = 0; window.atualizarTabela();
        document.getElementById('valor-total-input').value = "0.00";
    } catch(e) { alert("Erro: " + e.message); }
}

window.imprimirCupom = (nomeCliente, itens, total, desconto, data, vencimento) => {
    const printArea = document.querySelector('.print-container');
    const dataStr = data.toLocaleDateString('pt-BR');
    
    const totalLinhas = 10;
    const itensVazios = totalLinhas - itens.length;
    let linhasVaziasHTML = "";
    for(let i = 0; i < itensVazios; i++) {
        linhasVaziasHTML += `<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>`;
    }

    let itensHTML = "";
    let subtotal = 0;
    itens.forEach(item => {
        subtotal += item.preco * item.qtd;
        const cod = item.codigo_barras && item.codigo_barras !== "SEM GTIN" ? item.codigo_barras : (item.id.substring(0,6).toUpperCase());
        itensHTML += `
            <tr>
                <td class="nota-center">${item.qtd}</td>
                <td>${cod}</td>
                <td>${item.nome}</td>
                <td class="nota-right">${item.preco.toFixed(2)}</td>
                <td class="nota-right">${(item.preco * item.qtd).toFixed(2)}</td>
            </tr>
        `;
    });

    const gerarNotaHTML = (tituloVia) => `
        <div class="cupom-via">
            <div class="corte-texto" style="text-align: center; margin-bottom: 5px;">${tituloVia}</div>
            <div class="nota-box">
                <table class="nota-table" style="border-bottom: none;">
                    <tr>
                        <td colspan="5" style="text-align: center; border-bottom: 1px solid #000;">
                            <strong>STIR AUTO PEÇAS</strong><br>
                            CNPJ: 00.000.000/0001-00 - IE: ISENTO<br>
                            Rua Exemplo, 123 - Centro - Cidade/UF<br>
                            Tel: (XX) 99999-9999
                        </td>
                    </tr>
                    <tr>
                        <td colspan="5" style="border-bottom: 1px solid #000;">
                            <strong>DATA:</strong> ${dataStr} &nbsp;&nbsp;&nbsp; <strong>CLIENTE:</strong> ${nomeCliente}
                        </td>
                    </tr>
                    <tr style="background: #eee;">
                        <th style="width: 50px;" class="nota-center">QTD</th>
                        <th style="width: 100px;">CÓDIGO</th>
                        <th>DESCRIÇÃO DA PEÇA / SERVIÇO</th>
                        <th style="width: 80px;" class="nota-right">V. UNIT</th>
                        <th style="width: 80px;" class="nota-right">V. TOTAL</th>
                    </tr>
                </table>
                
                <table class="nota-table" style="border-top: none; border-bottom: none;">
                    ${itensHTML}
                    ${linhasVaziasHTML}
                </table>

                <table class="nota-table" style="border-top: 1px solid #000;">
                    <tr>
                        <td colspan="3" style="vertical-align: top; height: 50px;">
                            <strong>OBSERVAÇÕES:</strong><br>
                            ${vencimento ? 'Vencimento: ' + vencimento.toLocaleDateString('pt-BR') : ''}
                            <br><br>
                            ASSINATURA: __________________________________________
                        </td>
                        <td colspan="2" style="vertical-align: top;">
                            <div style="display: flex; justify-content: space-between;">
                                <span>SUBTOTAL:</span> <span>R$ ${subtotal.toFixed(2)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between;">
                                <span>DESCONTO:</span> <span>R$ ${desconto.toFixed(2)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-weight: bold; border-top: 1px solid #000; margin-top: 5px; padding-top: 5px;">
                                <span>TOTAL:</span> <span>R$ ${total.toFixed(2)}</span>
                            </div>
                        </td>
                    </tr>
                </table>
            </div>
        </div>
    `;

    printArea.innerHTML = `
        ${gerarNotaHTML("(VIA DA LOJA)")}
        <div class="corte-linha"><span class="corte-texto">CORTE AQUI</span></div>
        ${gerarNotaHTML("(VIA DO CLIENTE)")}
    `;

    setTimeout(() => { window.print(); }, 500);
}

window.addEventListener('DOMContentLoaded', () => { window.mostrarTela('dashboard'); });
