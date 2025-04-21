const sideLinks = document.querySelectorAll(".sidebar .side-menu li a:not(.logout)");

sideLinks.forEach((item) => {
  const li = item.parentElement;
  item.addEventListener("click", () => {
    sideLinks.forEach((i) => {
      i.parentElement.classList.remove("active");
    });
    li.classList.add("active");
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

async function loadPage(page) {
  try {
    // Adiciona timestamp para evitar cache
    const response = await fetch(`${page}?_=${Date.now()}`);
    
    if (!response.ok) {
      throw new Error(`Erro ${response.status} ao carregar a página`);
    }
    
    const html = await response.text();
    const content = document.getElementById('content');
    content.innerHTML = html;

    // Processa scripts da nova página
    const scripts = content.querySelectorAll("script");
    scripts.forEach(oldScript => {
      const newScript = document.createElement("script");
      // Copia todos os atributos
      Array.from(oldScript.attributes).forEach(attr => {
        newScript.setAttribute(attr.name, attr.value);
      });
      // Copia o conteúdo
      newScript.textContent = oldScript.textContent;
      // Substitui o script antigo
      oldScript.parentNode.replaceChild(newScript, oldScript);
    });

    // Força recarregamento de componentes específicos
    if (page.includes('colaboradores.html')) {
      await carregarColaboradores();
    }

    // Reinicializa componentes comuns
    initFormColaborador();
    
    // Rolagem para o topo (como em um refresh normal)
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

// Navegação do menu
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

// Carrega a página inicial
if (window.location.pathname.endsWith('/') || window.location.pathname.endsWith('/index.html')) {
  loadPage('dashboard.html');
} else {
  loadPage(window.location.pathname.split('/').pop());
}

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
          // Recarrega a lista após cadastro
          if (document.getElementById("tabela-colaboradores")) {
            await carregarColaboradores();
          }
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
        <td>${colaborador.nome}</td>
        <td>${colaborador.email}</td>
        <td>${colaborador.telefone}</td>
        <td>${colaborador.turma}</td>
        <td>${colaborador.sala}</td>
        <td>${new Date(colaborador.data).toLocaleDateString()}</td>
        <td>${colaborador.horario}</td>
        <td><img src="${colaborador.foto}" style="width: 50px;" /></td>
        <td>
          <button onclick="abrirEdicao(${colaborador.id})">Editar</button>
          <button onclick="confirmarExclusao(${colaborador.id})">Excluir</button>
        </td>
      `;

      tabela.appendChild(row);
    });
  } catch (error) {
    console.error("Erro ao carregar colaboradores:", error.message);
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

async function confirmarExclusao(id) {
  const confirmacao = confirm("Tem certeza que deseja excluir este colaborador?");
  if (!confirmacao) return;

  try {
    const response = await fetch(`/api/colaboradores/${id}`, {
      method: "DELETE"
    });

    const result = await response.json();
    if (response.ok) {
      alert("Colaborador excluído com sucesso.");
      await carregarColaboradores(); // Recarrega a lista atualizada
    } else {
      throw new Error(result.error || "Erro ao excluir colaborador.");
    }
  } catch (error) {
    console.error("Erro:", error);
    alert("Erro ao excluir colaborador.");
  }
}

// Controle do menu de perfil
const profileBtn = document.getElementById("profile-btn");
const profileMenu = document.getElementById("profile-menu");

if (profileBtn && profileMenu) {
  profileBtn.addEventListener("click", function (e) {
    e.preventDefault();
    profileMenu.style.display = profileMenu.style.display === "block" ? "none" : "block";
  });

  document.addEventListener("click", function (event) {
    const isClickInside = profileBtn.contains(event.target) || profileMenu.contains(event.target);
    if (!isClickInside) {
      profileMenu.style.display = "none";
    }
  });
}