// Arquivo de suporte do Cypress — executado antes de cada teste
// Aqui ficam comandos customizados e configurações globais

// Comando customizado: cadastrar ingrediente direto
Cypress.Commands.add('cadastrarIngrediente', ({ nome, unidade, preco, qtd, validade }) => {
  cy.get('[onclick="showPage(\'estoque\',this)"]').click()
  cy.get('[onclick="abrirModal()"]').click()
  cy.get('#modal-overlay').should('have.class', 'open')
  cy.get('#f-nome').clear().type(nome)
  if (unidade) cy.get('#f-unidade').select(unidade)
  cy.get('#f-preco').clear().type(preco)
  cy.get('#f-qtd').clear().type(qtd)
  if (validade) cy.get('#f-validade').type(validade)
  cy.get('[onclick="salvarIngrediente()"]').click()
})

// Suprimir erros de scripts externos (ex: Google Fonts) que não afetam os testes
Cypress.on('uncaught:exception', (err) => {
  if (err.message.includes('ResizeObserver') || err.message.includes('fonts')) return false
  return true
})