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

// ==========================================
// ESTADO GLOBAL DA APLICAÇÃO
// ==========================================
window.carrinho = [];
window.itensEntrada = [];
window.boletosEntrada = [];
let subtotalVenda = 0; 
let descontoGlobal = 0; 
let idProdutoEditando = null; 
window.todosClientes = []; 
window.todosProdutos = []; 
window.todasVendas = [];
window.equipe = []; 
window.tempVeiculosCadastro = []; // Array temporário para cadastro de veículos
// Variáveis da Câmera
let html5QrcodeScanner = null;
let destinoCamera = null;

// ==========================================
// FUNÇÃO MENU MOBILE
// ==========================================
window.alternarMenu = () => {
    const sidebar = document.getElementById('sidebar-principal');
    const overlay = document.getElementById('overlay-menu');
    sidebar.classList.toggle('menu-aberto');
    if(sidebar.classList.contains('menu-aberto')) overlay.style.display = 'block'; else overlay.style.display = 'none';
}

// ==========================================
// AUTENTICAÇÃO
// ==========================================
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
        window.carregarColaboradores();
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

// ==========================================
// NAVEGAÇÃO ENTRE TELAS
// ==========================================
window.mostrarTela = (telaId) => {
    document.querySelectorAll('.tela').forEach(t => t.style.display = 'none');
    document.querySelectorAll('.sidebar button').forEach(b => b.classList.remove('active'));
    const tela = document.getElementById('tela-' + telaId);
    if(tela) tela.style.display = 'block';
    const btn = document.getElementById('btn-' + telaId);
    if(btn) btn.classList.add('active');
    
    if(window.innerWidth <= 768) { document.getElementById('sidebar-principal').classList.remove('menu-aberto'); document.getElementById('overlay-menu').style.display = 'none'; }

    // Carregamentos Específicos por Tela
    if(telaId === 'vendas') { 
        document.getElementById('pdv-busca').focus(); 
        window.carregarClientes(); 
        window.carregarEstoque();
        window.carregarColaboradores().then(() => window.carregarOpcoesEquipePDV());
    }
    if(telaId === 'cadastro' || telaId === 'entrada') window.carregarEstoque();
    if(telaId === 'historico') window.carregarHistorico('vendas');
    if(telaId === 'clientes') window.carregarClientes();
    if(telaId === 'equipe') window.carregarColaboradores();
    if(telaId === 'relatorio') window.carregarOpcoesRelatorio();
    if(telaId === 'dashboard') window.carregarDashboard();
    if(telaId === 'financeiro') window.carregarContasPagar();
}

// ==========================================
// FUNÇÕES AUXILIARES DE INTERFACE
// ==========================================
window.alternarCamposCadastro = () => {
    const tipo = document.querySelector('input[name="tipo_produto"]:checked').value;
    const camposPeca = document.querySelectorAll('.campo-peca');
    camposPeca.forEach(el => el.style.display = (tipo === 'peca') ? 'block' : 'none');
    const camposServico = document.querySelectorAll('.campo-servico');
    camposServico.forEach(el => el.style.display = (tipo === 'servico') ? 'block' : 'none');
}

// ==========================================
// CÂMERA E SCANNER
// ==========================================
window.abrirCamera = (destino) => {
    destinoCamera = destino; // 'pdv' ou 'cadastro'
    const modal = document.getElementById('modal-camera');
    modal.style.display = 'block';

    if(!html5QrcodeScanner) {
        html5QrcodeScanner = new Html5QrcodeScanner(
            "leitor-camera",
            { fps: 10, qrbox: { width: 250, height: 250 } },
            /* verbose= */ false
        );
        html5QrcodeScanner.render(window.onScanSuccess, window.onScanFailure);
    }
}

window.onScanSuccess = (decodedText, decodedResult) => {
    // 1. SE FOR NO PDV
    if(destinoCamera === 'pdv') {
        const inputBusca = document.getElementById('pdv-busca');
        inputBusca.value = decodedText;
        window.filtrarProdutosPDV(); 
        
        // Tenta adicionar direto ao carrinho
        const produtoExato = window.todosProdutos.find(p => p.codigo_barras === decodedText);
        if(produtoExato) {
            window.adicionarAoCarrinho(produtoExato.id, produtoExato);
            inputBusca.value = ""; 
            alert("Produto adicionado: " + produtoExato.nome);
        } else {
            alert("Código lido: " + decodedText + ". Produto não encontrado.");
        }

    // 2. SE FOR NO CADASTRO
    } else if (destinoCamera === 'cadastro') {
        document.getElementById('cad-codigo').value = decodedText;
        alert("Código capturado!");
    }
    
    window.fecharCamera();
}

window.onScanFailure = (error) => {
    // console.warn(`Erro de leitura = ${error}`);
}

window.fecharCamera = () => {
    const modal = document.getElementById('modal-camera');
    modal.style.display = 'none';
    
    if(html5QrcodeScanner) {
        html5QrcodeScanner.clear().catch(error => {
            console.error("Erro ao fechar camera.", error);
        });
        html5QrcodeScanner = null;
    }
}

// ==========================================
// GESTÃO DE EQUIPE (CRUD)
// ==========================================
window.carregarColaboradores = async () => {
    const tbody = document.getElementById('lista-equipe');
    if(tbody) tbody.innerHTML = "<tr><td colspan='4'>Carregando...</td></tr>";
    
    try {
        const q = query(collection(db, "equipe"), orderBy("nome"));
        const snapshot = await getDocs(q);
        window.equipe = [];
        
        if(tbody) tbody.innerHTML = "";
        if(snapshot.empty && tbody) { 
            tbody.innerHTML = "<tr><td colspan='4'>Nenhum colaborador cadastrado.</td></tr>"; 
        }

        snapshot.forEach(doc => {
            const c = { id: doc.id, ...doc.data() };
            window.equipe.push(c); 
            if(tbody) {
                tbody.innerHTML += `
                    <tr>
                        <td><strong>${c.nome}</strong></td>
                        <td><span class="badge" style="background:#e0f2fe; color:#0369a1;">${c.cargo.toUpperCase()}</span></td>
                        <td>${c.telefone || '-'}</td>
                        <td><button onclick="excluirColaborador('${c.id}')" class="btn-secondary" style="color:red">Excluir</button></td>
                    </tr>
                `;
            }
        });
    } catch(e) { console.error("Erro ao carregar equipe:", e); }
}

window.carregarOpcoesEquipePDV = () => {
    const container = document.getElementById('pdv-opcoes-equipe-pneu');
    if(!container) return;
    
    container.innerHTML = "";
    if(window.equipe.length === 0) {
        container.innerHTML = "<small style='color:red;'>Cadastre a equipe no menu lateral!</small>";
        return;
    }

    window.equipe.forEach(colab => {
        const div = document.createElement('div');
        div.style.display = "flex";
        div.style.alignItems = "center";
        div.style.gap = "8px";
        div.innerHTML = `
            <input type="checkbox" name="equipe_pneu" value="${colab.nome}" id="chk_${colab.id}" style="width:18px; height:18px;">
            <label for="chk_${colab.id}" style="font-size:14px; cursor:pointer;">${colab.nome} <small style="color:#666">(${colab.cargo})</small></label>
        `;
        container.appendChild(div);
    });
}

window.carregarOpcoesRelatorio = async () => {
    if(window.equipe.length === 0) await window.carregarColaboradores();
    const select = document.getElementById('rel-colaborador');
    if(!select) return;
    
    select.innerHTML = '<option value="todos">Todos</option>';
    window.equipe.forEach(c => {
        select.innerHTML += `<option value="${c.nome}">${c.nome}</option>`;
    });
}

window.salvarColaborador = async () => {
    const nome = document.getElementById('eq-nome').value;
    const cargo = document.getElementById('eq-cargo').value;
    const telefone = document.getElementById('eq-fone').value;

    if(!nome) { alert("Digite o nome."); return; }

    try {
        await addDoc(collection(db, "equipe"), { nome, cargo, telefone });
        alert("Colaborador Cadastrado!");
        document.getElementById('eq-nome').value = "";
        document.getElementById('eq-fone').value = "";
        window.carregarColaboradores();
    } catch(e) { alert(e.message); }
}

window.excluirColaborador = async (id) => {
    if(confirm("Remover este colaborador da equipe?")) {
        await deleteDoc(doc(db, "equipe", id));
        window.carregarColaboradores();
    }
}

// ==========================================
// CONTAS A PAGAR (FINANCEIRO)
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
// IMPORTAÇÃO XML (NFe)
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

// ==========================================
// CLIENTES (COM MULTI-VEÍCULOS)
// ==========================================
window.addVeiculoNaLista = () => {
    const mod = document.getElementById('tmp-modelo').value;
    const pla = document.getElementById('tmp-placa').value;
    const ano = document.getElementById('tmp-ano').value;
    if(!mod) return alert("Digite o modelo do carro.");
    
    window.tempVeiculosCadastro.push({ modelo: mod, placa: pla, ano: ano });
    window.renderizarListaVeiculosCadastro();
    
    document.getElementById('tmp-modelo').value = "";
    document.getElementById('tmp-placa').value = "";
    document.getElementById('tmp-ano').value = "";
}

window.renderizarListaVeiculosCadastro = () => {
    const ul = document.getElementById('lista-veiculos-cadastro');
    if(!ul) return;
    ul.innerHTML = "";
    window.tempVeiculosCadastro.forEach((v, i) => {
        ul.innerHTML += `<li style="background:white; padding:5px; margin-bottom:5px; border:1px solid #ddd; display:flex; justify-content:space-between;">
            <span>🚗 ${v.modelo} (${v.placa})</span>
            <button onclick="window.tempVeiculosCadastro.splice(${i},1); window.renderizarListaVeiculosCadastro()" style="color:red; border:none; background:none;">X</button>
        </li>`;
    });
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
            veiculos: window.tempVeiculosCadastro
        };
        
        if(window.tempVeiculosCadastro.length > 0) {
            dados.carro_modelo = window.tempVeiculosCadastro[0].modelo;
            dados.carro_placa = window.tempVeiculosCadastro[0].placa;
        }

        await addDoc(collection(db, "clientes"), dados); 
        alert("Cliente Salvo!"); 
        document.querySelectorAll('#tela-clientes input').forEach(i => i.value = ""); 
        window.tempVeiculosCadastro = [];
        window.renderizarListaVeiculosCadastro();
        window.carregarClientes();
    } catch(e) { alert(e.message); }
}

window.carregarClientes = async () => {
    const tbody = document.getElementById('lista-clientes');
    try {
        const q = query(collection(db, "clientes"), orderBy("nome"));
        const querySnapshot = await getDocs(q);
        window.todosClientes = [];
        querySnapshot.forEach((doc) => {
            const c = { id: doc.id, ...doc.data() };
            window.todosClientes.push(c);
        });
        if(tbody) window.filtrarClientes();
    } catch (e) { console.error(e); }
}

window.filtrarClientes = () => {
    const termo = document.getElementById('busca-clientes').value.toLowerCase();
    const tbody = document.getElementById('lista-clientes');
    tbody.innerHTML = "";
    const filtrados = window.todosClientes.filter(c => c.nome.toLowerCase().includes(termo));
    filtrados.forEach(c => { 
        let veiculosStr = "Nenhum";
        if(c.veiculos && c.veiculos.length > 0) {
            veiculosStr = c.veiculos.map(v => `${v.modelo} (${v.placa})`).join(", ");
        } else if (c.carro_modelo) {
            veiculosStr = `${c.carro_modelo} (${c.carro_placa || ''})`;
        }
        tbody.innerHTML += `<tr><td><strong>${c.nome}</strong><br><small>${c.telefone||''}</small></td><td>${c.documento||'-'}</td><td>${veiculosStr}</td><td><button class="btn-secondary" style="color:red" onclick="excluirCliente('${c.id}')">X</button></td></tr>`; 
    });
}
window.excluirCliente = async(id) => { if(confirm("Excluir?")) { await deleteDoc(doc(db,"clientes",id)); window.carregarClientes(); } }


// ==========================================
// PDV INTELIGENTE (MULTI-VEÍCULOS)
// ==========================================
window.filtrarClientesPDV = () => {
    const termo = document.getElementById('pdv-busca-cliente').value.toLowerCase();
    const selectPdv = document.getElementById('pdv-cliente-select');
    selectPdv.innerHTML = '<option value="consumidor">Consumidor Final</option>';
    const filtrados = window.todosClientes.filter(c => c.nome.toLowerCase().includes(termo));
    filtrados.forEach(c => { selectPdv.innerHTML += `<option value="${c.nome}|${c.id}">${c.nome}</option>`; });
}

window.carregarVeiculosNoPDV = () => {
    const selectCli = document.getElementById('pdv-cliente-select');
    const selectVeic = document.getElementById('pdv-veiculo-select');
    selectVeic.innerHTML = '<option value="">Sem Veículo / Avulso</option>';
    
    if(selectCli.value === 'consumidor') return;
    
    const idCliente = selectCli.value.split('|')[1];
    const cliente = window.todosClientes.find(c => c.id === idCliente);
    
    if(cliente) {
        if(cliente.veiculos && cliente.veiculos.length > 0) {
            cliente.veiculos.forEach(v => {
                selectVeic.innerHTML += `<option value="${v.modelo}|${v.placa}">${v.modelo} - ${v.placa}</option>`;
            });
        } else if (cliente.carro_modelo) {
            selectVeic.innerHTML += `<option value="${cliente.carro_modelo}|${cliente.carro_placa}">${cliente.carro_modelo} - ${cliente.carro_placa}</option>`;
        }
    }
}

window.adicionarCarroRapido = async () => {
    const selectCli = document.getElementById('pdv-cliente-select');
    if(selectCli.value === 'consumidor') return alert("Selecione um cliente cadastrado primeiro.");
    
    const modelo = prompt("Modelo do Veículo:");
    if(!modelo) return;
    const placa = prompt("Placa do Veículo:");
    
    const idCliente = selectCli.value.split('|')[1];
    const clienteRef = doc(db, "clientes", idCliente);
    const cliente = window.todosClientes.find(c => c.id === idCliente);
    let veiculosAtuais = cliente.veiculos || [];
    
    if(veiculosAtuais.length === 0 && cliente.carro_modelo) {
        veiculosAtuais.push({ modelo: cliente.carro_modelo, placa: cliente.carro_placa || '', ano: '' });
    }
    veiculosAtuais.push({ modelo, placa, ano: '' });
    
    try {
        await updateDoc(clienteRef, { veiculos: veiculosAtuais });
        alert("Veículo adicionado!");
        window.carregarClientes().then(() => window.carregarVeiculosNoPDV());
    } catch(e) { alert("Erro ao salvar: " + e.message); }
}

// ==========================================
// DASHBOARD
// ==========================================
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

// ==========================================
// ESTOQUE / CADASTRO DE PRODUTOS
// ==========================================
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
        const tipoSelecionado = document.querySelector('input[name="tipo_produto"]:checked').value;
        const isServico = (tipoSelecionado === 'servico');

        const dados = {
            tipo: tipoSelecionado,
            nome: document.getElementById('cad-nome').value, 
            preco: parseFloat(document.getElementById('cad-preco').value) || 0, 
            preco_custo: parseFloat(document.getElementById('cad-custo').value) || 0,
            carros_compativeis: document.getElementById('cad-carros').value,
            
            codigo_barras: isServico ? "SERV-" + Date.now() : (document.getElementById('cad-codigo').value || "SEM GTIN"), 
            codigo_oem: isServico ? "" : document.getElementById('cad-oem').value, 
            ncm: isServico ? "" : document.getElementById('cad-ncm').value, 
            marca: isServico ? "" : document.getElementById('cad-marca').value,
            estoque_atual: isServico ? 9999 : (parseInt(document.getElementById('cad-estoque').value) || 0), 
            estoque_minimo: isServico ? 0 : (parseInt(document.getElementById('cad-minimo').value) || 0), 
            localizacao: isServico ? "" : document.getElementById('cad-local').value, 
            fornecedor: isServico ? "" : document.getElementById('cad-fornecedor').value,

            codigo_servico: isServico ? document.getElementById('cad-cod-servico').value : "",
            
            // SALVA A CATEGORIA DE COMISSÃO
            categoria_comissao: isServico ? document.getElementById('cad-cat-comissao').value : ""
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
    window.alternarCamposCadastro(); // Atualiza a visão

    document.getElementById('cad-nome').value = p.nome || ""; 
    document.getElementById('cad-preco').value = p.preco || ""; 
    document.getElementById('cad-custo').value = p.preco_custo || "";
    document.getElementById('cad-carros').value = p.carros_compativeis || "";

    if(!isServico) {
        document.getElementById('cad-codigo').value = p.codigo_barras || ""; 
        document.getElementById('cad-oem').value = p.codigo_oem || "";
        document.getElementById('cad-ncm').value = p.ncm || ""; 
        document.getElementById('cad-marca').value = p.marca || "";
        document.getElementById('cad-estoque').value = p.estoque_atual || "";
        document.getElementById('cad-minimo').value = p.estoque_minimo || "";
        document.getElementById('cad-local').value = p.localizacao || "";
        document.getElementById('cad-fornecedor').value = p.fornecedor || "";
    } else {
        document.getElementById('cad-cod-servico').value = p.codigo_servico || "";
        document.getElementById('cad-cat-comissao').value = p.categoria_comissao || "outros";
    }

    document.querySelector('.content').scrollTop = 0;
}
window.excluirProduto = async(id) => { if(confirm("Excluir?")) { await deleteDoc(doc(db,"produtos",id)); window.carregarEstoque(); } }

// ==========================================
// HISTÓRICO DE VENDAS
// ==========================================
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

    // Converter datas
    let dataVenda = new Date();
    if(venda.data && venda.data.seconds) dataVenda = new Date(venda.data.seconds * 1000);
    else if(venda.data) dataVenda = new Date(venda.data);

    let dataVenc = null;
    if(venda.vencimento && venda.vencimento.seconds) dataVenc = new Date(venda.vencimento.seconds * 1000);
    else if(venda.vencimento) dataVenc = new Date(venda.vencimento);

    // Reutiliza a função de imprimir
    window.imprimirCupom(venda.cliente, venda.itens, venda.total, venda.desconto || 0, dataVenda, dataVenc, venda.km, venda.carro, venda.placa);
}

window.cobrarZap = (cliente, valor) => { window.open(`https://wa.me/?text=Olá ${cliente}, lembrete de pagamento R$ ${valor}`, '_blank'); }

// ==========================================
// VENDAS (PDV) E COMISSÃO (CORRIGIDA E BLINDADA)
// ==========================================
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
                
            } else {
                // 2. Se não achou código, tenta achar nome exato na memória
                const matchNome = window.todosProdutos.find(p => p.nome.toLowerCase() === termo.toLowerCase());
                if(matchNome) {
                    adicionarAoCarrinho(matchNome.id, matchNome);
                    inputBusca.value = "";
                    document.getElementById('sugestoes-pdv').style.display = 'none';
                    
                } else {
                    document.getElementById('status-busca').innerText = "Não encontrado!"; 
                    
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

// 2. ATUALIZAÇÃO DA FINALIZAÇÃO DE VENDA (COMISSÃO INTELIGENTE)
window.finalizarVenda = async () => {
    if(window.carrinho.length === 0) return;
    
    // Recarrega equipe para garantir que temos os dados mais recentes
    if(window.equipe.length === 0) await window.carregarColaboradores();

    window.recalcularDescontoPeloTotal();
    const totalFinal = subtotalVenda - descontoGlobal;
    
    // Captura Executantes Pneu
    const containerPneu = document.getElementById('pdv-opcoes-equipe-pneu');
    let executantesPneu = [];
    if(containerPneu) {
        const checkboxes = containerPneu.querySelectorAll('input[type="checkbox"]:checked');
        checkboxes.forEach(chk => executantesPneu.push(chk.value));
    }
    
    // Captura KM e Carro
    const kmAtual = document.getElementById('pdv-km').value || "";
    let carroCliente = "", placaCliente = "";
    
    const veiculoSelect = document.getElementById('pdv-veiculo-select').value;
    if(veiculoSelect) {
        const parts = veiculoSelect.split('|');
        carroCliente = parts[0];
        placaCliente = parts[1];
    }
    
    const clienteSelect = document.getElementById('pdv-cliente-select').value;
    let nomeCliente = "Consumidor Final";
    if (clienteSelect !== "consumidor") nomeCliente = clienteSelect.split('|')[0];

    if(!confirm(`Confirmar venda de R$ ${totalFinal.toFixed(2)}?`)) return;

    try {
        const formaPagamento = document.getElementById('pdv-forma-pagamento').value;
        let dataVencimento = null;
        let statusVenda = "pago";
        if(formaPagamento === "prazo") {
            statusVenda = "pendente";
            const hoje = new Date();
            hoje.setDate(hoje.getDate() + 30);
            dataVencimento = hoje;
        }

        // --- LÓGICA BLINDADA DE COMISSÃO ---
        let comissoes = { "Empresa (Caixa)": 0 };
        
        window.carrinho.forEach(item => {
            const totalItem = item.preco * item.qtd;

            if (item.tipo === 'servico') {
                let cat = item.categoria_comissao || 'outros';
                
                // CORREÇÃO INTELIGENTE: Se esqueceu de categorizar, tenta adivinhar pelo nome
                const nome = item.nome.toLowerCase();
                if (cat === 'outros') {
                    if (nome.includes('alinhamento')) cat = 'alinhamento';
                    else if (nome.includes('pneu') || nome.includes('balanceamento')) cat = 'pneu';
                    else cat = 'mecanica'; // Assume Mecânica Geral para o resto
                }
                
                const metadeEmpresa = totalItem * 0.50;
                const metadeMaoDeObra = totalItem * 0.50;

                comissoes["Empresa (Caixa)"] += metadeEmpresa; // 50% Garantido Empresa

                if(cat === 'mecanica') {
                    const gestor = window.equipe.find(e => e.cargo === 'gestor');
                    const mecanico = window.equipe.find(e => e.cargo === 'mecanico');
                    const auxiliar = window.equipe.find(e => e.cargo === 'auxiliar');

                    let valorDistribuido = 0;

                    if(gestor) {
                        if(!comissoes[gestor.nome]) comissoes[gestor.nome] = 0;
                        const valor = metadeMaoDeObra * 0.40;
                        comissoes[gestor.nome] += valor;
                        valorDistribuido += valor;
                    }
                    if(mecanico) {
                        if(!comissoes[mecanico.nome]) comissoes[mecanico.nome] = 0;
                        const valor = metadeMaoDeObra * 0.40;
                        comissoes[mecanico.nome] += valor;
                        valorDistribuido += valor;
                    }
                    if(auxiliar) {
                        if(!comissoes[auxiliar.nome]) comissoes[auxiliar.nome] = 0;
                        const valor = metadeMaoDeObra * 0.20;
                        comissoes[auxiliar.nome] += valor;
                        valorDistribuido += valor;
                    }

                    // Se sobrar, volta para o caixa
                    const sobra = metadeMaoDeObra - valorDistribuido;
                    if(sobra > 0.01) {
                        comissoes["Empresa (Caixa)"] += sobra;
                    }
                } 
                else if (cat === 'alinhamento') {
                    // REGRA BLINDADA: Tenta achar Evandro, se não, cria "Evandro"
                    const beneficiario = window.equipe.find(e => e.cargo === 'gestor' || e.nome.toLowerCase().includes('evandro'));
                    const nomeBeneficiario = beneficiario ? beneficiario.nome : "Evandro";
                    
                    if(!comissoes[nomeBeneficiario]) comissoes[nomeBeneficiario] = 0;
                    comissoes[nomeBeneficiario] += metadeMaoDeObra;
                }
                else if (cat === 'pneu') {
                    if(executantesPneu.length > 0) {
                        const valorPorCabeca = metadeMaoDeObra / executantesPneu.length;
                        executantesPneu.forEach(nome => {
                            if(!comissoes[nome]) comissoes[nome] = 0;
                            comissoes[nome] += valorPorCabeca;
                        });
                    } else {
                        comissoes["Empresa (Caixa)"] += metadeMaoDeObra;
                    }
                }
                else {
                    comissoes["Empresa (Caixa)"] += metadeMaoDeObra;
                }
            } else {
                // PEÇA: 100% PARA EMPRESA
                comissoes["Empresa (Caixa)"] += totalItem;
            }
        });
        
        // Descontos saem do caixa da empresa
        if (descontoGlobal > 0) {
            comissoes["Empresa (Caixa)"] -= descontoGlobal;
        }

        await addDoc(collection(db, "vendas"), {
            data: new Date(), 
            subtotal: subtotalVenda, 
            desconto: descontoGlobal, 
            total: totalFinal,
            cliente: nomeCliente, 
            forma_pagamento: formaPagamento, 
            status: statusVenda, 
            vencimento: dataVencimento, 
            itens: window.carrinho,
            valores_comissao: comissoes,
            comissao_paga: false,
            km: kmAtual,
            carro: carroCliente,
            placa: placaCliente
        });

        // Baixa Estoque
        for (const item of window.carrinho) {
            if(item.tipo !== 'servico') {
                const itemRef = doc(db, "produtos", item.id);
                const atual = window.todosProdutos.find(p => p.id === item.id)?.estoque_atual || 0;
                await updateDoc(itemRef, { estoque_atual: atual - item.qtd });
            }
        }

        if(confirm("Deseja imprimir?")) window.imprimirCupom(nomeCliente, window.carrinho, totalFinal, descontoGlobal, new Date(), dataVencimento, kmAtual, carroCliente, placaCliente);
        
        alert("Venda Realizada com Sucesso!");
        
        window.carrinho = []; subtotalVenda = 0; descontoGlobal = 0; window.atualizarTabela();
        document.getElementById('valor-total-input').value = "0.00";
        document.getElementById('pdv-km').value = "";
        const chks = document.querySelectorAll('#pdv-opcoes-equipe-pneu input');
        chks.forEach(c => c.checked = false);

    } catch(e) { alert("Erro: " + e.message); }
}

// ==========================================
// RELATÓRIOS INTELIGENTES (NORMALIZAÇÃO)
// ==========================================

// Função auxiliar para normalizar nomes
const normalizarNome = (nome) => {
    if(!nome) return "Desconhecido";
    return nome.charAt(0).toUpperCase() + nome.slice(1).toLowerCase();
}

window.alternarStatusComissao = async (id, statusAtual) => {
    try {
        await updateDoc(doc(db, "vendas", id), { comissao_paga: !statusAtual });
        window.gerarRelatorioComissoes();
    } catch(e) { alert("Erro: " + e.message); }
}

// NOVO: SELEÇÃO EM MASSA
window.toggleTodasComissoes = (source) => {
    document.querySelectorAll('.check-comissao').forEach(c => c.checked = source.checked);
}

// NOVO: EXCLUSÃO EM MASSA
window.excluirRelatoriosSelecionados = async () => {
    const selecionados = document.querySelectorAll('.check-comissao:checked');
    if(selecionados.length === 0) return alert("Nenhum item selecionado.");
    
    if(confirm(`ATENÇÃO: Você vai excluir ${selecionados.length} vendas do sistema.\nIsso não pode ser desfeito.\n\nDeseja continuar?`)) {
        try {
            for(const chk of selecionados) {
                await deleteDoc(doc(db, "vendas", chk.value));
            }
            window.gerarRelatorioComissoes(); // Atualiza a tabela
            alert("Registros excluídos com sucesso!");
        } catch(e) { alert("Erro ao excluir: " + e.message); }
    }
}

// FUNÇÃO PARA MOSTRAR DETALHES (MODAL)
window.mostrarDetalhesComissao = (vendaJSON) => {
    const v = JSON.parse(decodeURIComponent(vendaJSON));
    const modal = document.getElementById('modal-detalhes');
    const conteudo = document.getElementById('conteudo-modal-detalhes');
    
    let html = `
        <h2 style="color:var(--primary); border-bottom:2px solid #eee; padding-bottom:10px;">Detalhes da Venda</h2>
        <p><strong>Cliente:</strong> ${v.cliente}</p>
        <p><strong>Data:</strong> ${new Date(v.data.seconds * 1000).toLocaleString()}</p>
        <p><strong>Veículo:</strong> ${v.carro || '-'} (${v.placa || '-'})</p>
        
        <h4 style="margin-top:20px;">Itens Vendidos:</h4>
        <ul style="list-style:none; padding:0;">
    `;
    
    // Lista os itens e explica a regra
    v.itens.forEach(item => {
        let regraTexto = "Peça (100% Empresa)";
        if(item.tipo === 'servico') {
            const cat = item.categoria_comissao || 'Outros';
            regraTexto = `Serviço (${cat.toUpperCase()})`;
        }
        
        html += `
            <li style="padding:10px; border-bottom:1px solid #eee;">
                <strong>${item.qtd}x ${item.nome}</strong> - R$ ${(item.preco * item.qtd).toFixed(2)}<br>
                <small style="color:#666;">Regra aplicada: ${regraTexto}</small>
            </li>
        `;
    });
    
    html += `</ul><h4 style="margin-top:20px;">Distribuição Financeira:</h4><table class="pdv-table">`;
    
    // Mostra quem ganhou o que
    let comissoes = v.valores_comissao || {};
    for (const [nome, valor] of Object.entries(comissoes)) {
        html += `<tr><td>${normalizarNome(nome)}</td><td><strong>R$ ${valor.toFixed(2)}</strong></td></tr>`;
    }
    
    html += `</table><div style="margin-top:20px; text-align:right;"><button class="btn-secondary" onclick="document.getElementById('modal-detalhes').style.display='none'">Fechar</button></div>`;
    
    conteudo.innerHTML = html;
    modal.style.display = 'block';
}

window.gerarRelatorioComissoes = async () => {
    const tbody = document.querySelector('#tabela-relatorio tbody');
    const header = document.querySelector('#tabela-relatorio thead');
    tbody.innerHTML = "<tr><td colspan='8'>Calculando...</td></tr>";
    
    // LER FILTROS DA TELA
    const inputInicio = document.getElementById('rel-inicio');
    const inputFim = document.getElementById('rel-fim');
    const selectColab = document.getElementById('rel-colaborador');

    let dataInicio, dataFim;

    if (inputInicio && inputInicio.value) {
        dataInicio = new Date(inputInicio.value + "T00:00:00");
    } else {
        // Padrão: 30 dias atrás
        dataInicio = new Date();
        dataInicio.setDate(dataInicio.getDate() - 30);
        dataInicio.setHours(0,0,0,0);
    }

    if (inputFim && inputFim.value) {
        dataFim = new Date(inputFim.value + "T23:59:59");
    } else {
        // Padrão: Hoje
        dataFim = new Date();
        dataFim.setHours(23,59,59,999);
    }

    const colaboradorFiltro = (selectColab && selectColab.value !== 'todos') ? selectColab.value : null;

    try {
        const q = query(collection(db, "vendas"), where("data", ">=", dataInicio), where("data", "<=", dataFim), orderBy("data", "desc"));
        const snapshot = await getDocs(q);
        
        let totais = { "Empresa (Caixa)": 0 };
        let colunasSet = new Set(["Empresa (Caixa)"]);
        let dadosProcessados = [];

        snapshot.forEach(docSnap => {
            const v = docSnap.data();
            let rawComissao = v.valores_comissao || { "Empresa (Caixa)": 0 };
            let comissaoNormalizada = {};

            // Normaliza chaves para evitar duplicatas
            Object.keys(rawComissao).forEach(key => {
                let nomeCorreto = key;
                // Padroniza a empresa
                if(key.toLowerCase().includes('empresa') || key.toLowerCase() === 'loja') nomeCorreto = "Empresa (Caixa)";
                else if(key === "Empresa (Caixa)") nomeCorreto = "Empresa (Caixa)";
                else nomeCorreto = normalizarNome(key);

                if(!comissaoNormalizada[nomeCorreto]) comissaoNormalizada[nomeCorreto] = 0;
                comissaoNormalizada[nomeCorreto] += rawComissao[key];
                
                colunasSet.add(nomeCorreto);
                if(!totais[nomeCorreto]) totais[nomeCorreto] = 0;
                totais[nomeCorreto] += rawComissao[key];
            });

            dadosProcessados.push({ id: docSnap.id, ...v, comissao: comissaoNormalizada });
        });

        // Ordena colunas (Empresa no final)
        let colunas = Array.from(colunasSet).sort().filter(c => c !== "Empresa (Caixa)");
        colunas.push("Empresa (Caixa)");

        // SE TIVER FILTRO DE COLABORADOR, FILTRA AS COLUNAS
        if(colaboradorFiltro) {
            // Normaliza o filtro também
            const filtroNorm = normalizarNome(colaboradorFiltro);
            // Mantém apenas a coluna do colaborador e a data/cliente
            colunas = [filtroNorm]; 
        }

        // Renderiza Cabeçalho Dinâmico (COM CHECKBOX MESTRE)
        let htmlHeader = `<tr style="background:#1e293b; color:white;">
            <th style="width:30px; text-align:center;"><input type="checkbox" onchange="toggleTodasComissoes(this)"></th>
            <th>Status</th><th>Data</th><th>Cliente</th><th>Total</th>`;
        colunas.forEach(c => htmlHeader += `<th>${c}</th>`);
        htmlHeader += `</tr>`;
        header.innerHTML = htmlHeader;

        // Renderiza Linhas
        tbody.innerHTML = "";
        let encontrouAlgo = false;

        dadosProcessados.forEach(v => {
            // Se filtrado, verifica se esse colaborador ganhou algo nessa venda
            if(colaboradorFiltro) {
                const filtroNorm = normalizarNome(colaboradorFiltro);
                if(!v.comissao[filtroNorm] || v.comissao[filtroNorm] === 0) return; // Pula venda se ele não ganhou nada
            }

            encontrouAlgo = true;
            const dataStr = v.data?.toDate ? v.data.toDate().toLocaleDateString('pt-BR') : "--";
            const isPago = v.comissao_paga === true;
            const styleRow = isPago ? "text-decoration:line-through; color:#999; background:#f3f4f6;" : "border-bottom:1px solid #eee;";
            const btnIcon = isPago ? "undo" : "check_circle";
            const btnColor = isPago ? "#999" : "#16a34a";
            const vendaJSON = encodeURIComponent(JSON.stringify(v));
            
            let htmlRow = `<tr style="${styleRow}">
                <td style="text-align:center;"><input type="checkbox" class="check-comissao" value="${v.id}"></td>
                <td style="text-align:center; min-width:80px;">
                    <button onclick="alternarStatusComissao('${v.id}', ${isPago})" title="Marcar Pago" style="border:none; background:transparent; cursor:pointer; color:${btnColor}">
                        <span class="material-icons">${btnIcon}</span>
                    </button>
                    <button onclick="mostrarDetalhesComissao('${vendaJSON}')" title="Ver Detalhes" style="border:none; background:transparent; cursor:pointer; color:#2563eb; margin-left:5px;">
                        <span class="material-icons">visibility</span>
                    </button>
                </td>
                <td style="font-size:12px;">${dataStr}</td>
                <td>${v.cliente}</td>
                <td>R$ ${v.total.toFixed(2)}</td>`;
            
            colunas.forEach(c => {
                let val = v.comissao[c] || 0;
                const cor = (c === 'Empresa (Caixa)') ? '#0369a1' : (isPago ? 'inherit' : '#16a34a');
                htmlRow += `<td style="color:${cor};">R$ ${val.toFixed(2)}</td>`;
            });
            htmlRow += `</tr>`;
            tbody.innerHTML += htmlRow;
        });

        if(!encontrouAlgo) {
            tbody.innerHTML = "<tr><td colspan='9'>Nenhum registro encontrado para este período/filtro.</td></tr>";
        } else {
            // Renderiza Totais
            let htmlTotal = `<tr style="background:#e0f2fe; font-weight:bold; border-top:2px solid #000;"><td colspan="5" style="text-align:right;">TOTAIS:</td>`;
            colunas.forEach(c => {
                htmlTotal += `<td style="color:${c==='Empresa (Caixa)'?'#0369a1':'#16a34a'}">R$ ${totais[c].toFixed(2)}</td>`;
            });
            htmlTotal += `</tr>`;
            tbody.innerHTML += htmlTotal;
        }

    } catch(e) { console.error(e); alert("Erro ao gerar relatório: " + e.message); }
}

// ==========================================
// IMPRESSÃO E RELATÓRIO DE ESTOQUE
// ==========================================
window.imprimirCupom = (nomeCliente, itens, total, desconto, data, vencimento, km, carro, placa) => {
    const printArea = document.querySelector('.print-container');
    const dataStr = data.toLocaleDateString('pt-BR');
    let infoVeiculo = "";
    if(carro || placa || km) infoVeiculo = `<tr><td colspan="5" style="border-bottom:1px solid #000; font-size:11px;"><strong>VEÍCULO:</strong> ${carro||''} (${placa||''}) <strong>KM:</strong> ${km||'--'}</td></tr>`;

    let itensHTML = "";
    itens.forEach(item => {
        const cod = item.codigo_barras && item.codigo_barras !== "SEM GTIN" ? item.codigo_barras : item.id.substring(0,6).toUpperCase();
        itensHTML += `<tr><td class="nota-center">${item.qtd}</td><td>${cod}</td><td>${item.nome}</td><td class="nota-right">${item.preco.toFixed(2)}</td><td class="nota-right">${(item.preco*item.qtd).toFixed(2)}</td></tr>`;
    });

    for(let i=itens.length; i<10; i++) itensHTML += `<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>`;

    const html = `
        <div class="cupom-via">
            <div class="nota-box">
                <table class="nota-table" style="border-bottom:none;">
                    <tr><td colspan="5" style="text-align:center; border-bottom:1px solid #000;"><strong>STIR AUTO PEÇAS</strong><br>CNPJ: 35.213.658/0001-66<br>Tel: (14) 99794-8553</td></tr>
                    <tr><td colspan="5" style="border-bottom:1px solid #000;"><strong>DATA:</strong> ${dataStr} <strong>CLIENTE:</strong> ${nomeCliente}</td></tr>
                    ${infoVeiculo}
                    <tr style="background:#eee;"><th class="nota-center">QTD</th><th>CÓD</th><th>DESCRIÇÃO</th><th class="nota-right">UNIT</th><th class="nota-right">TOTAL</th></tr>
                </table>
                <table class="nota-table" style="border-top:none; border-bottom:none;">${itensHTML}</table>
                <table class="nota-table" style="border-top:1px solid #000;">
                    <tr>
                        <td colspan="3" style="vertical-align:top; height:50px;"><strong>OBS:</strong><br>${vencimento ? 'Vencimento: '+vencimento.toLocaleDateString('pt-BR') : ''}<br><br>ASS: __________________</td>
                        <td colspan="2" style="vertical-align:top;">
                            <div style="display:flex; justify-content:space-between;"><span>SUB:</span><span>R$ ${(total+desconto).toFixed(2)}</span></div>
                            <div style="display:flex; justify-content:space-between;"><span>DESC:</span><span>R$ ${desconto.toFixed(2)}</span></div>
                            <div style="display:flex; justify-content:space-between; font-weight:bold; border-top:1px solid #000;"><span>TOTAL:</span><span>R$ ${total.toFixed(2)}</span></div>
                        </td>
                    </tr>
                </table>
            </div>
        </div>`;
    
    printArea.innerHTML = `${html}<div class="corte-linha">--- CORTE AQUI ---</div>${html}`;
    setTimeout(() => window.print(), 500);
}

window.recalcularDescontoPeloTotal = () => {
    const inputTotal = document.getElementById('valor-total-input');
    const novoTotal = parseFloat(inputTotal.value) || 0;
    descontoGlobal = (novoTotal < subtotalVenda) ? subtotalVenda - novoTotal : 0;
    inputTotal.value = novoTotal.toFixed(2);
}
window.atualizarQtd = (i, q) => { if(q>0) { window.carrinho[i].qtd = parseInt(q); window.atualizarTabela(); } }
window.removerItem = (i) => { window.carrinho.splice(i, 1); window.atualizarTabela(); }
window.gerarRelatorio = async () => { 
    const tbody = document.querySelector('#tabela-relatorio tbody'); 
    const thead = document.querySelector('#tabela-relatorio thead');
    thead.innerHTML = `<tr><th>Peça</th><th>Local</th><th>Atual</th><th>Mínimo</th><th>Status</th></tr>`;
    tbody.innerHTML = "<tr><td colspan='5'>Carregando...</td></tr>";
    try {
        const q = await getDocs(collection(db, "produtos")); 
        tbody.innerHTML = "";
        q.forEach((doc) => { 
            const p = doc.data(); 
            if (p.estoque_atual <= p.estoque_minimo && p.tipo !== 'servico') {
                tbody.innerHTML += `<tr><td>${p.nome}</td><td>${p.localizacao||'-'}</td><td>${p.estoque_atual}</td><td>${p.estoque_minimo}</td><td style="color:red; font-weight:bold">REPOR</td></tr>`; 
            }
        });
    } catch(e) { console.error(e); }
}
window.verDetalhesVenda = (jsonVenda) => { 
    const venda = JSON.parse(decodeURIComponent(jsonVenda)); 
    let d = new Date(); if(venda.data?.seconds) d = new Date(venda.data.seconds*1000); 
    let v = null; if(venda.vencimento?.seconds) v = new Date(venda.vencimento.seconds*1000); 
    window.imprimirCupom(venda.cliente, venda.itens, venda.total, venda.desconto||0, d, v, venda.km, venda.carro, venda.placa); 
}

window.addEventListener('DOMContentLoaded', () => { window.mostrarTela('dashboard'); });