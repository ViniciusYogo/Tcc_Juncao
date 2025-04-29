const sideLinks = document.querySelectorAll(".sidebar .side-menu li a:not(.logout)");

sideLinks.forEach((item) => {
  const li = item.parentElement;
  item.addEventListener("click", (e) => {
    // Se for o link de visualizar horários, permite o comportamento padrão
    if (item.getAttribute('data-page') === 'visualizar-horarios.html') {
      return;
    }
    
    e.preventDefault();
    sideLinks.forEach((i) => {
      i.parentElement.classList.remove("active");
    });
    li.classList.add("active");
    
    const page = item.getAttribute('data-page');
    if (page) {
      loadPage(page);
    }
  });
});

const menuBar = document.querySelector(".content nav .bx.bx-menu");
const sideBar = document.querySelector(".sidebar");

menuBar.addEventListener("click", () => {
  sideBar.classList.toggle("close");
});

const searchBtn = document.querySelector(".content nav form .form-input button");
const searchBtnIcon = document.querySelector(".content nav form .form-input button .bx");
const searchForm = document.querySelector(".content nav form");

searchBtn.addEventListener("click", function (e) {
  if (window.innerWidth < 576) {
    e.preventDefault();
    searchForm.classList.toggle("show");
    if (searchForm.classList.contains("show")) {
      searchBtnIcon.classList.replace("bx-search", "bx-x");
    } else {
      searchBtnIcon.classList.replace("bx-x", "bx-search");
    }
  }
});

window.addEventListener("resize", () => {
  if (window.innerWidth < 768) {
    sideBar.classList.add("close");
  } else {
    sideBar.classList.remove("close");
  }

  if (window.innerWidth > 576) {
    searchBtnIcon.classList.replace("bx-x", "bx-search");
    searchForm.classList.remove("show");
  }
});

const toggler = document.getElementById("theme-toggle");

toggler.addEventListener("change", function () {
  this.checked ? document.body.classList.add("dark") : document.body.classList.remove("dark");
});

// Sistema de navegação
const menuItems = document.querySelectorAll('.side-menu li a');
menuItems.forEach(item => {
  item.addEventListener('click', function (e) {
    e.preventDefault();
    const page = this.getAttribute('data-page') || this.getAttribute('href');
    if (page && !page.startsWith('#')) {
      loadPage(page);
    }
  });
});

// Carregamento inicial
if (window.location.pathname.endsWith('/') || window.location.pathname.endsWith('/index.html')) {
  loadPage('dashboard.html');
}

async function initCalendar() {
  if (document.querySelector('.calendario')) {
    // Carrega o CSS dinamicamente
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'visualizar-horarios.css';
    document.head.appendChild(link);
    
    // Carrega o script do calendário
    await new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'visualizar-horarios.js';
      script.onload = resolve;
      document.body.appendChild(script);
    });
  }
}

async function loadPage(page) {
  try {
    // Lista de páginas que devem ser redirecionadas (carregamento completo)
    const fullLoadPages = ['visualizar-horarios.html', 'inserirPlanilha.html'];
    
    // Verifica se a página solicitada está na lista de redirecionamento
    if (fullLoadPages.some(fullPage => page.includes(fullPage))) {
      window.location.href = page;
      return;
    }

    const response = await fetch(`${page}?_=${Date.now()}`);
    
    if (!response.ok) {
      throw new Error(`Erro ${response.status} ao carregar a página`);
    }
    
    const html = await response.text();
    const content = document.getElementById('content');
    content.innerHTML = html;

    // Processa scripts da nova página de forma mais segura
    const scripts = content.querySelectorAll("script");
    scripts.forEach(oldScript => {
      const newScript = document.createElement("script");
      
      // Copia todos os atributos exceto 'src' se já estiver carregado
      Array.from(oldScript.attributes).forEach(attr => {
        if (attr.name !== 'src' || !document.querySelector(`script[src="${attr.value}"]`)) {
          newScript.setAttribute(attr.name, attr.value);
        }
      });
      
      // Verifica se é um script inline
      if (!oldScript.src && oldScript.textContent) {
        newScript.textContent = `try { ${oldScript.textContent} } catch(e) { console.error('Error in inline script:', e); }`;
      }
      
      oldScript.parentNode.replaceChild(newScript, oldScript);
    });

    // Inicializa componentes específicos
    if (page.includes('colaboradores.html')) {
      await carregarColaboradores();
    }
    
    initFormColaborador();
    window.scrollTo(0, 0);
    
  } catch (error) {
    console.error("Erro ao carregar página:", error);
    document.getElementById('content').innerHTML = `
      <div class="error-message">
        <h3>Erro ao carregar a página</h3>
        <p>${error.message}</p>
        <button onclick="window.location.reload()">Tentar novamente</button>
      </div>
    `;
  }
}


loadPage('dashboard.html');

function initFormColaborador() {
  const form = document.getElementById("form-colaborador");
  if (form) {
    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      const formData = new FormData(form);
      try {
        const response = await fetch("/api/colaboradores/criar", {
          method: "POST",
          body: formData
        });
        const result = await response.json();
        if (response.ok) {
          alert("Colaborador cadastrado com sucesso!");
          form.reset();
        } else {
          throw new Error(result.error || "Erro ao cadastrar colaborador.");
        }
      } catch (error) {
        console.error("Erro:", error);
        alert("Erro ao cadastrar colaborador. Verifique o console.");
      }
    });
  }

  const inputFile = document.getElementById("profile-picture");
  const fileNameDisplay = document.getElementById("file-name");
  if (inputFile && fileNameDisplay) {
    inputFile.addEventListener("change", function(event) {
      const file = event.target.files[0];
      fileNameDisplay.textContent = file ? file.name : 'Nenhum arquivo escolhido';
    });
  }
}

// Gestão de Colaboradores
async function carregarColaboradores() {
  try {
    const response = await fetch(`/api/colaboradores?_=${Date.now()}`);    
    if (!response.ok) {
      throw new Error(`Erro HTTP! status: ${response.status}`);
    }
    
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      throw new TypeError("A resposta não é JSON");
    }
    
    const data = await response.json();
    const tabela = document.querySelector("#tabela-colaboradores tbody");
    if (!tabela) return;
    tabela.innerHTML = "";

    data.forEach(colaborador => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${colaborador.primeiro_nome} ${colaborador.ultimo_nome || ''}</td>
        <td>${colaborador.email || '-'}</td>
        <td>${colaborador.numero_contato || '-'}</td>
        <td>${colaborador.turma || '-'}</td>
        <td>${colaborador.sala || '-'}</td>
        <td>${colaborador.data ? new Date(colaborador.data).toLocaleDateString() : '-'}</td>
        <td>${colaborador.horario || '-'}</td>
        <td><img src="${colaborador.foto || 'https://i.pravatar.cc/50'}" style="width: 50px;" /></td>
        <td>
          <button onclick="abrirEdicao(${colaborador.id})">Editar</button>
          <button onclick="confirmarExclusao(${colaborador.id})">Excluir</button>
        </td>
      `;
      tabela.appendChild(row);
    });
    
  } catch (error) {
    console.error("Erro ao carregar colaboradores:", error);
    const tabela = document.querySelector("#tabela-colaboradores tbody");
    if (tabela) {
      tabela.innerHTML = `
        <tr>
          <td colspan="9" class="error">
            Erro ao carregar dados: ${error.message}
            <button onclick="carregarColaboradores()">Tentar novamente</button>
          </td>
        </tr>
      `;
    }
  }
}

function initFormColaborador() {
  const form = document.getElementById("form-colaborador");
  if (!form) return;

  // Elementos da UI
  const submitBtn = form.querySelector('button[type="submit"]');
  const fileNameDisplay = document.getElementById("file-name");
  const previewImg = document.getElementById("preview");
  const tabelaColaboradores = document.getElementById("tabela-colaboradores");

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    
    // Desabilita o botão durante o processamento
    submitBtn.disabled = true;
    const originalBtnText = submitBtn.textContent;
    submitBtn.textContent = "Cadastrando...";
    
    try {
      const formData = new FormData(form);
      
      // Validação básica dos campos obrigatórios
      const requiredFields = ['primeiro_nome', 'ultimo_nome', 'email', 'nome_usuario', 'senha'];
      for (const field of requiredFields) {
        if (!formData.get(field)) {
          throw new Error(`O campo ${field.replace('_', ' ')} é obrigatório`);
        }
      }

      // Validação de e-mail
      const email = formData.get('email');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error('Por favor, insira um e-mail válido');
      }

      const response = await fetch("/api/colaboradores", {
        method: "POST",
        body: formData
      });

      // Verifica se a resposta é JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(text || 'Resposta inválida do servidor');
      }

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || result.message || "Erro ao cadastrar colaborador");
      }

      // Sucesso no cadastro
      alert(result.message || "Colaborador cadastrado com sucesso!");
      
      // Reset do formulário
      form.reset();
      if (fileNameDisplay) fileNameDisplay.textContent = 'Nenhum arquivo escolhido';
      if (previewImg) previewImg.style.display = 'none';
      
      // Atualiza a tabela se existir
      if (tabelaColaboradores) {
        await carregarColaboradores();
      }
      
    } catch (error) {
      console.error("Erro:", error);
      
      // Mostra mensagem de erro amigável
      let errorMessage = error.message;
      
      // Tratamento específico para erros de rede
      if (error.message.includes('Failed to fetch')) {
        errorMessage = "Não foi possível conectar ao servidor. Verifique sua conexão.";
      }
      
      alert(`Erro: ${errorMessage}`);
      
    } finally {
      // Reabilita o botão independente do resultado
      submitBtn.disabled = false;
      submitBtn.textContent = originalBtnText;
    }
  });

  // Mostrar nome do arquivo e pré-visualização da imagem
  const inputFile = document.getElementById("profile-picture");
  if (inputFile && fileNameDisplay) {
    inputFile.addEventListener("change", function(event) {
      const file = event.target.files[0];
      
      if (file) {
        // Validação do tipo de arquivo
        if (!file.type.match('image.*')) {
          alert('Por favor, selecione uma imagem (JPEG, PNG, etc.)');
          event.target.value = '';
          fileNameDisplay.textContent = 'Nenhum arquivo escolhido';
          if (previewImg) previewImg.style.display = 'none';
          return;
        }
        
        // Validação do tamanho do arquivo (5MB)
        if (file.size > 5 * 1024 * 1024) {
          alert('A imagem deve ter no máximo 5MB');
          event.target.value = '';
          fileNameDisplay.textContent = 'Nenhum arquivo escolhido';
          if (previewImg) previewImg.style.display = 'none';
          return;
        }
        
        fileNameDisplay.textContent = file.name;
        
        // Mostra pré-visualização se o elemento existir
        if (previewImg) {
          const reader = new FileReader();
          reader.onload = function(e) {
            previewImg.src = e.target.result;
            previewImg.style.display = 'block';
          };
          reader.readAsDataURL(file);
        }
      } else {
        fileNameDisplay.textContent = 'Nenhum arquivo escolhido';
        if (previewImg) previewImg.style.display = 'none';
      }
    });
  }
}

async function confirmarExclusao(id) {
  if (!confirm("Tem certeza que deseja excluir este colaborador?")) return;

  try {
    const response = await fetch(`/api/colaboradores/${id}`, {
      method: "DELETE"
    });
    
    const result = await response.json();
    
    if (response.ok) {
      alert(result.message || "Colaborador excluído com sucesso.");
      await carregarColaboradores();
    } else {
      throw new Error(result.error || "Erro ao excluir colaborador");
    }
  } catch (error) {
    console.error("Erro:", error);
    alert(error.message || "Erro ao excluir colaborador.");
  }
}

// Menu de perfil
const profileBtn = document.getElementById("profile-btn");
const profileMenu = document.getElementById("profile-menu");

if (profileBtn && profileMenu) {
  profileBtn.addEventListener("click", function (e) {
    e.preventDefault();
    profileMenu.style.display = profileMenu.style.display === "block" ? "none" : "block";
  });

  document.addEventListener("click", function (event) {
    if (!profileBtn.contains(event.target) && !profileMenu.contains(event.target)) {
      profileMenu.style.display = "none";
    }
  });
}