import { getThinkers, type Thinker } from './content';

/**
 * The suggested reading order: stages, each built around a question the thinkers in it
 * try to answer. Every thinker in the Hall appears exactly once; the build
 * fails if one is missing or misspelt.
 */
export const PATH = [
  {
    title: 'Where the questions begin',
    question: 'What is a good life, and how would we know?',
    blurb:
      'Start with the teachers who first asked the big questions, in Athens, in the Ganges plain and in ancient China, and with the students who turned those questions into systems.',
    ids: ['socrates', 'siddhartha-gautama', 'confucius', 'laozi', 'plato', 'aristotle'],
  },
  {
    title: 'How to stay steady',
    question: 'How do I live well when I cannot control what happens?',
    blurb:
      'Three Stoics, a millionaire, a former slave and an emperor, turn philosophy into daily practice for hard times.',
    ids: ['seneca', 'epictetus', 'marcus-aurelius'],
  },
  {
    title: 'Faith and reason',
    question: 'Can faith and reason live together?',
    blurb:
      'A North African bishop turns philosophy inward, a judge in Muslim Spain argues that scripture commands us to think, an Italian friar builds a cathedral of reason, and a statesman in Tunis finds the laws behind the rise and fall of empires.',
    ids: ['augustine', 'ibn-rushd', 'thomas-aquinas', 'ibn-khaldun'],
  },
  {
    title: 'What can we really know?',
    question: 'Does knowledge come from reason, or from experience?',
    blurb:
      'The great argument of the early modern age: rationalists who trusted reason, empiricists who trusted the senses, and Kant, who tried to settle it.',
    ids: ['rene-descartes', 'baruch-spinoza', 'gottfried-leibniz', 'john-locke', 'david-hume', 'immanuel-kant'],
  },
  {
    title: 'How should a society be run?',
    question: 'What makes laws, markets and governments fair and free?',
    blurb:
      'Why obey a government at all? The social contract, the separation of powers, free markets, the defence of tradition, the greatest happiness, and the liberty of the individual.',
    ids: [
      'thomas-hobbes',
      'montesquieu',
      'jean-jacques-rousseau',
      'adam-smith',
      'edmund-burke',
      'jeremy-bentham',
      'john-stuart-mill',
    ],
  },
  {
    title: 'History, money and power',
    question: 'Does history have a direction, and who does it serve?',
    blurb:
      'Hegel sees history as freedom coming to know itself; Marx turns it into a story of class struggle; Luxemburg insists that socialism must keep freedom alive.',
    ids: ['georg-hegel', 'karl-marx', 'rosa-luxemburg'],
  },
  {
    title: 'Freedom, the Indian way',
    question: 'What does it take for a people to be truly free?',
    blurb:
      'Four Indians who argued about religion, nation, caste and non-violence while India fought for its freedom, and who did not agree with each other.',
    ids: ['swami-vivekananda', 'rabindranath-tagore', 'mk-gandhi', 'br-ambedkar'],
  },
  {
    title: 'Meaning and freedom',
    question: 'If no one hands us a meaning, how do we live?',
    blurb:
      'The existentialists end the journey where you are: alone with your choices, responsible for what you make of yourself.',
    ids: ['soren-kierkegaard', 'friedrich-nietzsche', 'jean-paul-sartre', 'simone-de-beauvoir'],
  },
] as const;

export async function getPath() {
  const thinkers = await getThinkers();
  const byId = new Map(thinkers.map((t) => [t.id, t]));
  const order = PATH.flatMap((stage) => stage.ids as readonly string[]);

  const missing = thinkers.filter((t) => !order.includes(t.id)).map((t) => t.id);
  const unknown = order.filter((id) => !byId.has(id));
  const dupes = order.filter((id, i) => order.indexOf(id) !== i);
  if (missing.length || unknown.length || dupes.length) {
    throw new Error(
      `Reading path out of date. Missing: ${missing.join(', ') || 'none'}; ` +
        `unknown: ${unknown.join(', ') || 'none'}; repeated: ${dupes.join(', ') || 'none'}.`,
    );
  }

  const stages = PATH.map((stage) => ({ ...stage, thinkers: stage.ids.map((id) => byId.get(id)!) }));
  const flat: Thinker[] = order.map((id) => byId.get(id)!);

  /** Where a thinker sits in the path, with the one before and after. */
  const position = (id: string) => {
    const i = order.indexOf(id);
    const stageIndex = PATH.findIndex((s) => (s.ids as readonly string[]).includes(id));
    return {
      step: i + 1,
      total: order.length,
      stage: PATH[stageIndex]!,
      stageNumber: stageIndex + 1,
      prev: flat[i - 1],
      next: flat[i + 1],
    };
  };

  return { stages, flat, position };
}
