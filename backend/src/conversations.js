import { getDb, saveDb } from './store.js';
import { badRequest, notFound } from './errors.js';
import { generateId, nowIso, pick } from './utils.js';

const summary = (chat) => pick(chat, ['id', 'title', 'createdAt', 'updatedAt']);

export function getConversation(id, user) {
  const chat = getDb().conversations.find((item) => item.id === id && item.ownerId === user.id);
  if (!chat) throw notFound('Conversation not found.');
  return chat;
}

export function listConversations(user, offsetValue) {
  const offset = Number(offsetValue || 0);
  if (!Number.isSafeInteger(offset) || offset < 0) throw badRequest('Invalid history offset.');
  const chats = getDb().conversations.filter((item) => item.ownerId === user.id)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return { items: chats.slice(offset, offset + 30).map(summary), hasMore: chats.length > offset + 30 };
}

export async function askWithHistory(body, user, answerQuestion) {
  if (typeof body.question !== 'string' || !body.question.trim() || body.question.trim().length > 1000) {
    throw badRequest('Enter a question of up to 1000 characters.');
  }
  const question = body.question.trim();
  const chat = body.conversationId ? getConversation(body.conversationId, user) : null;
  if (chat && chat.messages.length >= 200) throw badRequest('This conversation is full. Start a new chat to continue.');
  const answer = await answerQuestion({ question }, user);
  const now = nowIso();
  const conversation = chat || {
    id: generateId('CHAT'), ownerId: user.id, title: question.replace(/\s+/g, ' ').slice(0, 80),
    createdAt: now, updatedAt: now, messages: [],
  };
  conversation.messages.push(
    { id: generateId('MSG'), type: 'user', text: question, createdAt: now },
    { id: generateId('MSG'), type: 'assistant', text: answer.answer, ...pick(answer, ['source', 'sourceUrl', 'officialLinks', 'next', 'actionView', 'actionLabel']), createdAt: now },
  );
  conversation.updatedAt = now;
  if (!chat) getDb().conversations.push(conversation);
  saveDb();
  return { conversation: { ...summary(conversation), messages: conversation.messages } };
}
