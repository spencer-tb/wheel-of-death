import { secureRandom } from './utils';

// The team, as pictured under static/avengers, each with lines their
// character actually says in the films
export interface AvengersMember {
	name: string;
	hero: string;
	image: string;
	quotes: string[];
}

export const AVENGERS_ROSTER: AvengersMember[] = [
	{
		name: 'Spencer',
		hero: 'Thanos',
		image: '/avengers/spencer-thanos.webp',
		quotes: [
			'I am inevitable.',
			'Perfectly balanced, as all things should be.',
			"Fine, I'll do it myself.",
			'Dread it. Run from it. Destiny arrives all the same.',
			'You should have gone for the head.',
			'The hardest choices require the strongest wills.',
			"I know what it's like to lose.",
			'Reality can be whatever I want.',
			'You could not live with your own failure. Where did that bring you? Back to me.'
		]
	},
	{
		name: 'Jochem',
		hero: 'Star-Lord',
		image: '/avengers/jochem-lord.webp',
		quotes: [
			"I'm Star-Lord, man. Legendary outlaw.",
			'Dance-off, bro. Me and you.',
			'I have part of a plan.',
			'Twelve percent of a plan.',
			'Something good, something bad, a bit of both?',
			'I come from Earth, a planet of outlaws.',
			"We're the Guardians of the Galaxy."
		]
	},
	{
		name: 'Guru',
		hero: 'Doctor Strange',
		image: '/avengers/guru-strange.webp',
		quotes: [
			"Dormammu, I've come to bargain.",
			"We're in the endgame now.",
			'There was no other way.',
			'Forget everything you think you know.',
			"It's Strange.",
			'I went forward in time to see all the possible outcomes.',
			"It's not about you."
		]
	},
	{
		name: 'Louis',
		hero: 'Spider-Man',
		image: '/avengers/spider-louis.webp',
		quotes: [
			"Mr. Stark, I don't feel so good.",
			"I'm just a friendly neighborhood Spider-Man.",
			'Karen, activate instant kill.',
			'With great power, there must also come great responsibility.',
			"I'm from Queens.",
			"I'm Peter, by the way."
		]
	},
	{
		name: 'Dan',
		hero: 'Thor',
		image: '/avengers/dan-thor.webp',
		quotes: [
			'Bring me Thanos!',
			"He's a friend from work!",
			"I'm still worthy!",
			'Is he, though?',
			'This drink, I like it! Another!',
			'I am Thor, son of Odin.',
			"I notice you've copied my beard.",
			'Get help!'
		]
	},
	{
		name: 'Felipe',
		hero: 'Captain America',
		image: '/avengers/felipe-america.webp',
		quotes: [
			'I can do this all day.',
			'On your left.',
			'Avengers, assemble.',
			'I understood that reference.',
			'Language!',
			"I'm just a kid from Brooklyn.",
			"I'm with you till the end of the line.",
			"I don't like bullies. I don't care where they're from.",
			'Hail Hydra.'
		]
	},
	{
		name: 'Mario',
		hero: 'Iron Man',
		image: '/avengers/mario-man.webp',
		quotes: [
			'I am Iron Man.',
			'Genius, billionaire, playboy, philanthropist.',
			'I love you 3000.',
			'Part of the journey is the end.',
			'We have a Hulk.',
			'Doth mother know you weareth her drapes?',
			'Sometimes you gotta run before you can walk.',
			"I'm bringing the party to you.",
			"If we can't protect the Earth, you can be damned sure we'll avenge it."
		]
	}
];

// Subtitle under the title while the team is assembled: lines from the films
const AVENGERS_TAGLINES = [
	'Avengers, assemble.',
	'I am Iron Man.',
	'I can do this all day.',
	'We have a Hulk.',
	"Dormammu, I've come to bargain.",
	'I am inevitable.',
	'On your left.',
	'Part of the journey is the end.',
	'Whatever it takes.',
	'Perfectly balanced, as all things should be.',
	'I love you 3000.',
	"That's my secret, Cap. I'm always angry.",
	'Puny god.',
	'Bring me Thanos!',
	"He's a friend from work!",
	'I understood that reference.',
	"Fine, I'll do it myself.",
	'You should have gone for the head.',
	'Dread it. Run from it. Destiny arrives all the same.',
	'Wakanda forever!',
	'I am Groot.',
	"Hey, big guy. Sun's getting real low.",
	'Language!',
	'Genius, billionaire, playboy, philanthropist.'
];

export function getAvengersTagline(): string {
	return AVENGERS_TAGLINES[Math.floor(secureRandom() * AVENGERS_TAGLINES.length)];
}

// Shown when the wheel picks someone who is not in the roster
const AVENGERS_PHRASES = [
	'Avengers, assemble:',
	'Suit up:',
	'The hero we need:',
	'The snap chooses:',
	'Whatever it takes:',
	"Earth's mightiest:",
	'Nick Fury is calling:',
	'The stones have spoken:',
	'Next to assemble:',
	'The Avengers Initiative picks:',
	'I am inevitable:',
	'On your left:'
];

// A line from the picked person's own character, or a general one for
// anyone who is not in the roster
export function getAvengersPhrase(image?: string): string {
	const member = AVENGERS_ROSTER.find((m) => m.image === image);
	const list = member?.quotes ?? AVENGERS_PHRASES;
	return list[Math.floor(secureRandom() * list.length)];
}
