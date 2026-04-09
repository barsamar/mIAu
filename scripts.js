const botao = document.querySelector("#miar")
const campoTexto = document.querySelector("#texto")
const mensagens = document.querySelector("#mensagens")
const historico = document.querySelector("#historico")
const novoChatBtn = document.querySelector("#novoChat")

const chave = "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"
const endpoint = "https://api.groq.com/openai/v1/chat/completions"

let chats = JSON.parse(localStorage.getItem("miau_chats")) || []
let chatAtualId = localStorage.getItem("miau_chat_atual") || null

function salvarChats() {
    localStorage.setItem("miau_chats", JSON.stringify(chats))
    localStorage.setItem("miau_chat_atual", chatAtualId)
}

function criarNovoChat() {
    const id = Date.now().toString()

    const novoChat = {
        id,
        titulo: "novo chat",
        mensagens: []
    }

    chats.unshift(novoChat)
    chatAtualId = id
    salvarChats()
    renderizarHistorico()
    renderizarMensagens()
}

function pegarChatAtual() {
    return chats.find(chat => chat.id === chatAtualId)
}

function atualizarTituloChat(chat) {
    const primeiraMensagemUsuario = chat.mensagens.find(msg => msg.role === "user")

    if (primeiraMensagemUsuario) {
        chat.titulo = primeiraMensagemUsuario.content.slice(0, 28)

        if (primeiraMensagemUsuario.content.length > 28) {
            chat.titulo += "..."
        }
    }
}

function adicionarMensagemNaTela(texto, tipo, classeExtra = "") {
    const div = document.createElement("div")
    div.classList.add("mensagem", tipo)

    if (classeExtra) {
        div.classList.add(classeExtra)
    }

    div.innerText = texto
    mensagens.appendChild(div)
    mensagens.scrollTop = mensagens.scrollHeight
    return div
}

function renderizarMensagens() {
    mensagens.innerHTML = ""

    const chatAtual = pegarChatAtual()
    if (!chatAtual) return

    chatAtual.mensagens.forEach(msg => {
        const tipo = msg.role === "user" ? "usuario" : "ia"
        adicionarMensagemNaTela(msg.content, tipo)
    })
}

function apagarChat(id) {
    chats = chats.filter(chat => chat.id !== id)

    if (chatAtualId === id) {
        if (chats.length > 0) {
            chatAtualId = chats[0].id
        } else {
            chatAtualId = null
            criarNovoChat()
            return
        }
    }

    salvarChats()
    renderizarHistorico()
    renderizarMensagens()
}

function fecharTodosMenus() {
    document.querySelectorAll(".menu-opcoes").forEach(menu => {
        menu.classList.remove("aberto")
    })
}

function renderizarHistorico() {
    historico.innerHTML = ""

    chats.forEach(chat => {
        const item = document.createElement("div")
        item.classList.add("item-historico")

        if (chat.id === chatAtualId) {
            item.classList.add("ativo")
        }

        item.innerHTML = `
            <span class="titulo-chat">${chat.titulo}</span>

            <div class="menu-wrapper">
                <button class="menu-chat" title="opções">⋮</button>

                <div class="menu-opcoes">
                    <button class="apagar-chat">(x) apagar chat</button>
                </div>
            </div>
        `

        item.addEventListener("click", () => {
            chatAtualId = chat.id
            salvarChats()
            renderizarHistorico()
            renderizarMensagens()
        })

        const botaoMenu = item.querySelector(".menu-chat")
        const menuOpcoes = item.querySelector(".menu-opcoes")
        const botaoApagar = item.querySelector(".apagar-chat")

        botaoMenu.addEventListener("click", (e) => {
            e.stopPropagation()

            const estaAberto = menuOpcoes.classList.contains("aberto")
            fecharTodosMenus()

            if (!estaAberto) {
                menuOpcoes.classList.add("aberto")
            }
        })

        botaoApagar.addEventListener("click", (e) => {
            e.stopPropagation()
            apagarChat(chat.id)
        })

        historico.appendChild(item)
    })
}

function mostrarPensando() {
    return adicionarMensagemNaTela("pensando...", "ia", "pensando")
}

function escreverMensagem(elemento, texto, velocidade = 18) {
    elemento.innerText = ""
    let i = 0

    function digitar() {
        if (i < texto.length) {
            elemento.innerText += texto.charAt(i)
            i++
            mensagens.scrollTop = mensagens.scrollHeight
            setTimeout(digitar, velocidade)
        }
    }

    digitar()
}

function esperar(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

async function miar() {
    const texto = campoTexto.value.trim()
    if (!texto) return

    let chatAtual = pegarChatAtual()

    if (!chatAtual) {
        criarNovoChat()
        chatAtual = pegarChatAtual()
    }

    chatAtual.mensagens.push({
        role: "user",
        content: texto
    })

    atualizarTituloChat(chatAtual)
    salvarChats()
    renderizarHistorico()
    renderizarMensagens()

    campoTexto.value = ""

    const bolhaPensando = mostrarPensando()
    const inicioPensando = Date.now()

    try {
        const resposta = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + chave
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                    {
                        role: "system",
                        content: "você é uma assistente especializada em medicina veterinária. responda de forma clara, direta e organizada."
                    },
                    ...chatAtual.mensagens
                ]
            })
        })

        const dados = await resposta.json()

        const tempoMinimoPensando = 1000
        const tempoPassado = Date.now() - inicioPensando

        if (tempoPassado < tempoMinimoPensando) {
            await esperar(tempoMinimoPensando - tempoPassado)
        }

        bolhaPensando.remove()

        if (!dados.choices) {
            const erroApi = "erro da api: " + JSON.stringify(dados)

            chatAtual.mensagens.push({
                role: "assistant",
                content: erroApi
            })

            salvarChats()
            renderizarMensagens()
            return
        }

        const respostaIA = dados.choices[0].message.content

        chatAtual.mensagens.push({
            role: "assistant",
            content: respostaIA
        })

        salvarChats()

        const bolhaResposta = adicionarMensagemNaTela("", "ia")
        escreverMensagem(bolhaResposta, respostaIA, 18)

    } catch (erro) {
        const tempoMinimoPensando = 1000
        const tempoPassado = Date.now() - inicioPensando

        if (tempoPassado < tempoMinimoPensando) {
            await esperar(tempoMinimoPensando - tempoPassado)
        }

        bolhaPensando.remove()

        chatAtual.mensagens.push({
            role: "assistant",
            content: "erro de conexão"
        })

        salvarChats()
        renderizarMensagens()
    }
}

botao.addEventListener("click", miar)

campoTexto.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        miar()
    }
})

novoChatBtn.addEventListener("click", () => {
    criarNovoChat()
})

document.addEventListener("click", () => {
    fecharTodosMenus()
})

if (chats.length === 0) {
    criarNovoChat()
} else if (!chatAtualId || !pegarChatAtual()) {
    chatAtualId = chats[0].id
    salvarChats()
}

renderizarHistorico()
renderizarMensagens()