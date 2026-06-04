/**
 * Validação de payloads de ingrediente.
 * Implementação manual leve — não depende de zod/joi/yup para manter o bundle enxuto.
 */

import { AppError } from '../errors/app-error.js';
import type {
  IngredienteInput,
  IngredienteUpdateInput,
  CompraInput,
  Unidade,
} from '../models/ingrediente.model.js';

const UNIDADES_VALIDAS: readonly Unidade[] = ['kg', 'g', 'L', 'ml', 'un'] as const;

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isValidIsoDate(v: unknown): v is string {
  return typeof v === 'string' && ISO_DATE_REGEX.test(v) && !Number.isNaN(Date.parse(v));
}

/**
 * Valida e normaliza payload de criação de ingrediente.
 * Lança AppError(400) se inválido.
 */
export function validateIngredienteInput(body: unknown): IngredienteInput {
  if (!body || typeof body !== 'object') {
    throw new AppError('Corpo da requisição inválido', 400);
  }

  const b = body as Record<string, unknown>;

  // nome
  const nome = typeof b.nome === 'string' ? b.nome.trim() : '';
  if (!nome) throw new AppError('Campo "nome" é obrigatório', 400);
  if (nome.length > 150) throw new AppError('Campo "nome" deve ter no máximo 150 caracteres', 400);

  // unidade
  const unidade = b.unidade as Unidade;
  if (!UNIDADES_VALIDAS.includes(unidade)) {
    throw new AppError(`Campo "unidade" deve ser um de: ${UNIDADES_VALIDAS.join(', ')}`, 400);
  }

  // preco
  const preco = Number(b.preco);
  if (!isFiniteNumber(preco) || preco < 0) {
    throw new AppError('Campo "preco" deve ser um número >= 0', 400);
  }

  // qtd
  const qtd = Number(b.qtd);
  if (!isFiniteNumber(qtd) || qtd < 0) {
    throw new AppError('Campo "qtd" deve ser um número >= 0', 400);
  }

  // qtdMax (opcional)
  let qtdMax: number | undefined;
  if (b.qtdMax !== undefined && b.qtdMax !== null && b.qtdMax !== '') {
    qtdMax = Number(b.qtdMax);
    if (!isFiniteNumber(qtdMax) || qtdMax <= 0) {
      throw new AppError('Campo "qtdMax" deve ser um número > 0', 400);
    }
  }

  // validade (opcional)
  let validade: string | null = null;
  if (b.validade !== undefined && b.validade !== null && b.validade !== '') {
    if (!isValidIsoDate(b.validade)) {
      throw new AppError('Campo "validade" deve estar no formato YYYY-MM-DD', 400);
    }
    validade = b.validade as string;
  }

  return { nome, unidade, preco, qtd, qtdMax, validade };
}

/**
 * Valida payload de atualização parcial (PUT /ingredientes/:id).
 *
 * Regras:
 *  - todos os campos são opcionais, mas pelo menos um deve ser enviado;
 *  - `qtd` é REJEITADO explicitamente — estoque só muda via compra/retirada;
 *  - `validade` aceita null ou '' para LIMPAR a data.
 *
 * Lança AppError(400) se inválido.
 */
export function validateIngredienteUpdate(body: unknown): IngredienteUpdateInput {
  if (!body || typeof body !== 'object') {
    throw new AppError('Corpo da requisição inválido', 400);
  }

  const b = body as Record<string, unknown>;

  // qtd é protegido por auditoria — não pode ser editado por aqui
  if ('qtd' in b) {
    throw new AppError(
      'Campo "qtd" não pode ser editado diretamente. Use POST /ingredientes/:id/compras (entrada) ou /retirada (saída).',
      400,
    );
  }

  const update: IngredienteUpdateInput = {};

  // nome
  if (b.nome !== undefined) {
    const nome = typeof b.nome === 'string' ? b.nome.trim() : '';
    if (!nome) throw new AppError('Campo "nome" não pode ser vazio', 400);
    if (nome.length > 150) throw new AppError('Campo "nome" deve ter no máximo 150 caracteres', 400);
    update.nome = nome;
  }

  // unidade
  if (b.unidade !== undefined) {
    const unidade = b.unidade as Unidade;
    if (!UNIDADES_VALIDAS.includes(unidade)) {
      throw new AppError(`Campo "unidade" deve ser um de: ${UNIDADES_VALIDAS.join(', ')}`, 400);
    }
    update.unidade = unidade;
  }

  // preco
  if (b.preco !== undefined) {
    const preco = Number(b.preco);
    if (!isFiniteNumber(preco) || preco < 0) {
      throw new AppError('Campo "preco" deve ser um número >= 0', 400);
    }
    update.preco = preco;
  }

  // qtdMax
  if (b.qtdMax !== undefined) {
    const qtdMax = Number(b.qtdMax);
    if (!isFiniteNumber(qtdMax) || qtdMax <= 0) {
      throw new AppError('Campo "qtdMax" deve ser um número > 0', 400);
    }
    update.qtdMax = qtdMax;
  }

  // validade — null ou '' limpa a data
  if (b.validade !== undefined) {
    if (b.validade === null || b.validade === '') {
      update.validade = null;
    } else if (!isValidIsoDate(b.validade)) {
      throw new AppError('Campo "validade" deve estar no formato YYYY-MM-DD', 400);
    } else {
      update.validade = b.validade as string;
    }
  }

  if (Object.keys(update).length === 0) {
    throw new AppError('Envie ao menos um campo para atualizar', 400);
  }

  return update;
}

/**
 * Valida payload de uma nova compra (entrada de estoque).
 */
export function validateCompraInput(body: unknown): CompraInput {
  if (!body || typeof body !== 'object') {
    throw new AppError('Corpo da requisição inválido', 400);
  }

  const b = body as Record<string, unknown>;

  const quantidade = Number(b.quantidade);
  if (!isFiniteNumber(quantidade) || quantidade <= 0) {
    throw new AppError('Campo "quantidade" deve ser um número > 0', 400);
  }

  const precoUnitario = Number(b.precoUnitario);
  if (!isFiniteNumber(precoUnitario) || precoUnitario <= 0) {
    throw new AppError('Campo "precoUnitario" deve ser um número > 0', 400);
  }

  let validade: string | null | undefined;
  if (b.validade !== undefined && b.validade !== null && b.validade !== '') {
    if (!isValidIsoDate(b.validade)) {
      throw new AppError('Campo "validade" deve estar no formato YYYY-MM-DD', 400);
    }
    validade = b.validade as string;
  }

  const observacao = typeof b.observacao === 'string' ? b.observacao : undefined;

  return { quantidade, precoUnitario, validade, observacao };
}

/**
 * Valida e converte param :id de URL.
 */
export function validateId(rawId: string): number {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError('Parâmetro "id" inválido', 400);
  }
  return id;
}