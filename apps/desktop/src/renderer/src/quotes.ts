/**
 * Real words, for the people who live here.
 *
 * Every quote is attributed to a real person (or text). Documented sources
 * preferred; a few founder lines are kept as those founders speak them — all
 * attributable. Ordered thematically (tools → building → insight → mastery)
 * but shuffled fresh on every launch, so order doesn't matter.
 *
 * Shown one at a time, once every two minutes. Tap to advance.
 */
export interface Quote {
  text: string;
  author: string;
}

export const QUOTES: Quote[] = [
  // — tools & attention —
  { text: "We shape our tools and thereafter our tools shape us.", author: "John Culkin, 1967" },
  { text: "If I have seen further it is by standing on the shoulders of giants.", author: "Isaac Newton, 1675" },
  { text: "Information wants to be free.", author: "Stewart Brand, 1984" },
  { text: "All models are wrong, but some are useful.", author: "George Box" },
  { text: "Less, but better.", author: "Dieter Rams" },
  { text: "Less is more.", author: "Ludwig Mies van der Rohe" },
  { text: "The most damaging phrase in the language is: we have always done it this way.", author: "Grace Hopper" },
  { text: "Measuring programming progress by lines of code is like measuring aircraft building progress by weight.", author: "Bill Gates" },
  // — building —
  { text: "What I cannot create, I do not understand.", author: "Richard Feynman" },
  { text: "The best way to predict the future is to invent it.", author: "Alan Kay" },
  { text: "People who are really serious about software should make their own hardware.", author: "Alan Kay" },
  { text: "Talk is cheap. Show me the code.", author: "Linus Torvalds" },
  { text: "Premature optimization is the root of all evil.", author: "Donald Knuth" },
  { text: "Given enough eyeballs, all bugs are shallow.", author: "Eric S. Raymond" },
  { text: "The philosophers have only interpreted the world, in various ways. The point is to change it.", author: "Karl Marx, 11th Thesis on Feuerbach" },
  { text: "Hell, there are no rules here — we are trying to accomplish something.", author: "Thomas Edison" },
  { text: "I was taught that the way of progress was neither swift nor easy.", author: "Marie Curie" },
  { text: "Training is everything. The peach was once a bitter almond; cauliflower is nothing but cabbage with a college education.", author: "Mark Twain" },
  { text: "Genius is one percent inspiration and ninety-nine percent perspiration.", author: "Thomas Edison" },
  // — the AI era —
  { text: "AI is the new electricity.", author: "Andrew Ng" },
  { text: "Solve intelligence, and then use that to solve everything else.", author: "Demis Hassabis" },
  { text: "There is nothing artificial about AI.", author: "Fei-Fei Li" },
  { text: "Deep learning is going to be able to do everything.", author: "Geoffrey Hinton" },
  { text: "Reinforcement learning is the cherry on the cake.", author: "Yann LeCun" },
  { text: "The hottest new programming language is English.", author: "Andrej Karpathy" },
  { text: "AI is probably the most important thing humanity has ever worked on.", author: "Sundar Pichai" },
  { text: "A country of geniuses in a data center.", author: "Dario Amodei" },
  { text: "Compounding is magic.", author: "Sam Altman" },
  { text: "Software is eating the world, but AI is going to eat software.", author: "Jensen Huang" },
  { text: "Our industry does not respect tradition; it only respects innovation.", author: "Satya Nadella" },
  { text: "The first ultraintelligent machine is the last invention that man need ever make.", author: "I.J. Good, 1965" },
  { text: "The development of full artificial intelligence could spell the end of the human race.", author: "Stephen Hawking" },
  { text: "With artificial intelligence we are summoning the demon.", author: "Elon Musk" },
  { text: "When something is important enough, you do it even if the odds are not in your favor.", author: "Elon Musk" },
  { text: "We can only see a short distance ahead, but we can see plenty there that needs to be done.", author: "Alan Turing, 1950" },
  { text: "As soon as it works, no one calls it AI anymore.", author: "John McCarthy" },
  { text: "The question of whether machines can think is about as relevant as whether submarines can swim.", author: "Edsger Dijkstra" },
  { text: "The Analytical Engine has no pretensions whatever to originate anything.", author: "Ada Lovelace, 1843" },
  { text: "Our technology, our machines, is part of our humanity.", author: "Ray Kurzweil" },
  { text: "Take X and add AI.", author: "Kevin Kelly" },
  // — founders & builders —
  { text: "Software is eating the world.", author: "Marc Andreessen, 2011" },
  { text: "Innovation distinguishes between a leader and a follower.", author: "Steve Jobs" },
  { text: "Design is not just what it looks like and feels like. Design is how it works.", author: "Steve Jobs" },
  { text: "Content is king.", author: "Bill Gates" },
  { text: "Your most unhappy customers are your greatest source of learning.", author: "Bill Gates" },
  { text: "Move fast and break things.", author: "Mark Zuckerberg" },
  { text: "The biggest risk is not taking any risk.", author: "Mark Zuckerberg" },
  { text: "It is always Day 1.", author: "Jeff Bezos" },
  { text: "We are stubborn on vision. We are flexible on details.", author: "Jeff Bezos" },
  { text: "Always deliver more than expected.", author: "Larry Page" },
  { text: "Competition is for losers.", author: "Peter Thiel" },
  { text: "If you are not embarrassed by the first version of your product, you have launched too late.", author: "Reid Hoffman" },
  { text: "Make something people want.", author: "Paul Graham" },
  { text: "Do things that don't scale.", author: "Paul Graham" },
  { text: "The Web as I envisaged it, we have not seen it yet.", author: "Tim Berners-Lee" },
  { text: "Debugging is twice as hard as writing the code in the first place.", author: "Brian Kernighan" },
  { text: "Adding manpower to a late software project makes it later.", author: "Fred Brooks" },
  { text: "The most profound technologies are those that disappear.", author: "Mark Weiser, 1991" },
  { text: "Any sufficiently advanced technology is indistinguishable from magic.", author: "Arthur C. Clarke, 1962" },
  { text: "Never trust a computer you can't throw out a window.", author: "Steve Wozniak" },
  { text: "If you're offered a seat on a rocket ship, don't ask what seat. Just get on.", author: "Sheryl Sandberg" },
  { text: "The more you buy, the more you save.", author: "Jensen Huang" },
  { text: "Simplicity is a prerequisite for reliability.", author: "Edsger Dijkstra" },
  { text: "Real artists ship.", author: "Steve Jobs" },
  { text: "We can fix anything.", author: "David Heinemeier Hansson" },
  // — insight & attention —
  { text: "The purpose of computing is insight, not numbers.", author: "Richard Hamming" },
  { text: "The unexamined life is not worth living.", author: "Socrates, via Plato" },
  { text: "Know thyself.", author: "Inscription at the Temple of Apollo, Delphi" },
  { text: "He who learns without thinking is lost; he who thinks without learning is in great danger.", author: "Confucius, Analects 2:15" },
  { text: "We are what we think. All that we are arises with our thoughts; with our thoughts, we make the world.", author: "Buddha, Dhammapada" },
  { text: "Man is but a reed, the weakest in nature, but he is a thinking reed.", author: "Blaise Pascal" },
  { text: "I think, therefore I am.", author: "René Descartes" },
  { text: "Extraordinary claims require extraordinary evidence.", author: "Carl Sagan" },
  { text: "Somewhere, something incredible is waiting to be known.", author: "Carl Sagan" },
  { text: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin" },
  { text: "The map is not the territory.", author: "Alfred Korzybski" },
  // — mastery & temperament —
  { text: "No man ever steps in the same river twice.", author: "Heraclitus" },
  { text: "The journey of a thousand miles begins with one step.", author: "Lao Tzu, Tao Te Ching" },
  { text: "That which does not kill us makes us stronger.", author: "Friedrich Nietzsche" },
  { text: "He who has a why to live can bear almost any how.", author: "Friedrich Nietzsche" },
  { text: "Fortune favors the bold.", author: "Virgil" },
  { text: "Do what you can, with what you have, where you are.", author: "Theodore Roosevelt" },
  { text: "The credit belongs to the man who is actually in the arena.", author: "Theodore Roosevelt" },
  { text: "Stay hungry, stay foolish.", author: "Steve Jobs" },
  { text: "Innovation is saying no to a thousand things.", author: "Steve Jobs" },
  { text: "The empires of the future are the empires of the mind.", author: "Winston Churchill" },
];

/** Fisher–Yates, fresh array every call. */
export function shuffledIndices(length: number): number[] {
  const a = Array.from({ length }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
