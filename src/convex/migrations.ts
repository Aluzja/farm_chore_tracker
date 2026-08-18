import { v } from 'convex/values';
import { internalMutation } from './_generated/server';
import { ensureFeedTypes } from './feedTypes';

// One-off migration: move feed amounts out of free-form descriptions into
// structured feedItems. Rules were derived by reviewing every active master
// chore. A rule only applies when the chore's current description matches
// `from` (whitespace-normalized), so re-running or running against a
// deployment with edited data is safe - mismatches are reported, not patched.
//
// Run:  npx convex run migrations:migrateFeedToStructured '{"dryRun":true,"todayDate":"YYYY-MM-DD"}'

type FeedItem = { feed: string; amount: number; unit: string };

interface Rule {
	text: string;
	timeSlot: string;
	from: string;
	feedItems: FeedItem[];
	to?: string; // New description; omit to remove it entirely
}

const LAYER = 'Layer Feed';
const GAME_BIRD = 'Game Bird';
const CORN = 'Corn';
const SUN = 'Sunflower Seeds';
const SHEEP = 'Sheep Text';
const RABBIT = 'Rabbit Feed';
const CUBES = 'Alfalfa Cubes';
const PELLETS = 'Alfalfa Pellets';

const RULES: Rule[] = [
	{
		text: 'Feed Chickens. Take pic of food on scale.',
		timeSlot: 'morning',
		from: '12 Layer Feed | 4 lbsGame Bird | 2 lbs corn| 1 lb sunflowers  Put Wood Board Back On',
		feedItems: [
			{ feed: LAYER, amount: 12, unit: 'lb' },
			{ feed: GAME_BIRD, amount: 4, unit: 'lb' },
			{ feed: CORN, amount: 2, unit: 'lb' },
			{ feed: SUN, amount: 1, unit: 'lb' }
		],
		to: 'Put wood board back on'
	},
	{
		text: 'Feed Chickens. Picture of food on the scale.',
		timeSlot: 'evening',
		from: '12 layer | 4 lbs game bird 2 lbs corn | 1 lb sunflowers  | put wooden board back on',
		feedItems: [
			{ feed: LAYER, amount: 12, unit: 'lb' },
			{ feed: GAME_BIRD, amount: 4, unit: 'lb' },
			{ feed: CORN, amount: 2, unit: 'lb' },
			{ feed: SUN, amount: 1, unit: 'lb' }
		],
		to: 'Put wooden board back on'
	},
	{
		text: 'Chicken Tractor foods.',
		timeSlot: 'morning',
		from: '0.75 lb of layer per tractor.',
		feedItems: [{ feed: LAYER, amount: 0.75, unit: 'lb' }],
		to: 'Per tractor'
	},
	{
		text: 'Feed Ducks (64)',
		timeSlot: 'morning',
		from: '22 lbs  layer in feed troughs. Will need to spread out the feed more since there’s more ducks!!  near the fence by four port',
		feedItems: [{ feed: LAYER, amount: 22, unit: 'lb' }],
		to: 'In feed troughs near the fence by four port. Spread out the feed more since there’s more ducks!!'
	},
	{
		text: 'Feed Geese',
		timeSlot: 'morning',
		from: '0.5 lb of layer in feed trough placed behind barn by the pallets',
		feedItems: [{ feed: LAYER, amount: 0.5, unit: 'lb' }],
		to: 'In feed trough placed behind barn by the pallets'
	},
	{
		text: 'Feed aster',
		timeSlot: 'morning',
		from: '1 hand of sheep. By hand',
		feedItems: [{ feed: SHEEP, amount: 1, unit: 'hand' }],
		to: 'By hand'
	},
	{
		text: 'Feed aster',
		timeSlot: 'evening',
		from: 'One hand f sheep. By hand.',
		feedItems: [{ feed: SHEEP, amount: 1, unit: 'hand' }],
		to: 'By hand'
	},
	{
		text: 'Blue cubes',
		timeSlot: 'morning',
		from: '5 lbs cubes. Secure feeder',
		feedItems: [{ feed: CUBES, amount: 5, unit: 'lb' }],
		to: 'Secure feeder'
	},
	{
		text: 'Feed blue',
		timeSlot: 'morning',
		from: 'Blue gets 2 lbs sheep and 1 lb rabbit/ 2 hand of sun',
		feedItems: [
			{ feed: SHEEP, amount: 2, unit: 'lb' },
			{ feed: RABBIT, amount: 1, unit: 'lb' },
			{ feed: SUN, amount: 2, unit: 'hand' }
		]
	},
	{
		text: 'Feed blue',
		timeSlot: 'evening',
		from: '1 lb sheep 1 lb rabbit /2 hands of suns.',
		feedItems: [
			{ feed: SHEEP, amount: 1, unit: 'lb' },
			{ feed: RABBIT, amount: 1, unit: 'lb' },
			{ feed: SUN, amount: 2, unit: 'hand' }
		]
	},
	{
		text: 'Poppy',
		timeSlot: 'morning',
		from: 'Hand of sheep. By hand!',
		feedItems: [{ feed: SHEEP, amount: 1, unit: 'hand' }],
		to: 'By hand!'
	},
	{
		text: 'Poppy',
		timeSlot: 'evening',
		from: 'Hand of sheep.',
		feedItems: [{ feed: SHEEP, amount: 1, unit: 'hand' }]
	},
	{
		text: 'Feed Nilla',
		timeSlot: 'morning',
		from: '| 3 lb  Sheep Text| hand of sun seeds PIC ON SCALE',
		feedItems: [
			{ feed: SHEEP, amount: 3, unit: 'lb' },
			{ feed: SUN, amount: 1, unit: 'hand' }
		],
		to: 'PIC ON SCALE'
	},
	{
		text: 'Feed Nilla',
		timeSlot: 'evening',
		from: '1 lb sheep pic on scale',
		feedItems: [{ feed: SHEEP, amount: 1, unit: 'lb' }],
		to: 'Pic on scale'
	},
	{
		text: 'Feed Bunny',
		timeSlot: 'morning',
		from: '| 2.0 lb Sheep Text |PIC ON SCALE',
		feedItems: [{ feed: SHEEP, amount: 2, unit: 'lb' }],
		to: 'PIC ON SCALE'
	},
	{
		text: 'Feed Bunny',
		timeSlot: 'evening',
		from: '0.5lb Rabbit | 2.5 lb Sheep Text| hand of sun seeds PIC ON SCALE',
		feedItems: [
			{ feed: RABBIT, amount: 0.5, unit: 'lb' },
			{ feed: SHEEP, amount: 2.5, unit: 'lb' },
			{ feed: SUN, amount: 1, unit: 'hand' }
		],
		to: 'PIC ON SCALE'
	},
	{
		text: 'Feed Sheep',
		timeSlot: 'morning',
		from: '25 lb  alfalfa cubes in main pen. IF NO GRASS. ten lbs if there’s grass.  Remove previous cubes. Weigh and add more to equal ten pounds PIC ON SCALE',
		feedItems: [{ feed: CUBES, amount: 25, unit: 'lb' }],
		to: 'In main pen IF NO GRASS — only 10 lbs if there’s grass. Remove previous cubes, weigh and add more to equal the total. PIC ON SCALE'
	},
	{
		text: 'Feed Sheep Big Pen',
		timeSlot: 'evening',
		from: '30 cubes to Big Pen. Remove previous cubes. Weigh them and add cubes to make the 30 lbs PIC ON SCALE',
		feedItems: [{ feed: CUBES, amount: 30, unit: 'lb' }],
		to: 'Big Pen. Remove previous cubes, weigh them and add cubes to make the total. PIC ON SCALE'
	},
	{
		text: 'Give sushi  food',
		timeSlot: 'morning',
		from: 'Handful of sunflower seeds to sushi',
		feedItems: [{ feed: SUN, amount: 1, unit: 'hand' }]
	},
	{
		text: 'Alfalfa pellets',
		timeSlot: 'morning',
		from: '1 pound of alfalfa pellets PIC ON SCALE sprinkled on their wet and dry cubes in the trough',
		feedItems: [{ feed: PELLETS, amount: 1, unit: 'lb' }],
		to: 'PIC ON SCALE. Sprinkled on their wet and dry cubes in the trough'
	},
	{
		text: 'Goat grain',
		timeSlot: 'morning',
		from: 'Hand of sheep text to goats.smalll hand to the boys. Just a nibble',
		feedItems: [{ feed: SHEEP, amount: 1, unit: 'hand' }],
		to: 'Small hand to the boys. Just a nibble'
	},
	{
		text: 'Goat grain',
		timeSlot: 'evening',
		from: 'One handful to each goat. Use feed pan if necessary but I’d like them to be hand fed.  SMALL hand to the boys.like just a nibble',
		feedItems: [{ feed: SHEEP, amount: 1, unit: 'hand' }],
		to: 'One handful to each goat, hand fed (use feed pan if necessary). SMALL hand to the boys, just a nibble'
	},
	{
		// The soaked 2 lbs is weighed in the evening PREP chore - this is the dry top-up only
		text: 'Goat cubes',
		timeSlot: 'morning',
		from: 'Empty last nights cubes. .PIC OF NEW FEED ON SCALE  Give to sheep ( next to not on top of their regular cubes. Not included in their weight) Dump soaked cubes into trough. Add 3 lbs of dry cubes on top of wet food.',
		feedItems: [{ feed: CUBES, amount: 3, unit: 'lb' }],
		to: 'Empty last nights cubes, give to sheep (next to, not on top of their regular cubes — not included in their weight). PIC OF NEW FEED ON SCALE. Dump soaked cubes into trough, add dry cubes on top of wet food.'
	},
	{
		text: 'Goat cubes PREP FOR MORNING',
		timeSlot: 'evening',
		from: 'Soak 2 lbs  cubes with water to just above the cubes level in bucket. Cover with feed bag.',
		feedItems: [{ feed: CUBES, amount: 2, unit: 'lb' }],
		to: 'Soak cubes with water to just above the cubes level in bucket. Cover with feed bag.'
	}
];

// Collapse whitespace so double spaces in stored data don't break matching
function normalize(s: string | undefined): string {
	return (s ?? '').replace(/\s+/g, ' ').trim();
}

export const migrateFeedToStructured = internalMutation({
	args: {
		dryRun: v.optional(v.boolean()),
		todayDate: v.optional(v.string()) // Also patch this date's daily clones
	},
	handler: async (ctx, { dryRun = false, todayDate }) => {
		const masters = await ctx.db
			.query('masterChores')
			.withIndex('by_active', (q) => q.eq('isActive', true))
			.collect();

		const updated: string[] = [];
		const mismatched: { chore: string; current: string }[] = [];
		const notFound: string[] = [];

		if (!dryRun) {
			await ensureFeedTypes(ctx, [LAYER, GAME_BIRD, CORN, SUN, SHEEP, RABBIT, CUBES, PELLETS]);
		}

		for (const rule of RULES) {
			const label = `${rule.text} [${rule.timeSlot}]`;
			const master = masters.find((m) => m.text === rule.text && m.timeSlot === rule.timeSlot);

			if (!master) {
				notFound.push(label);
				continue;
			}
			if (normalize(master.description) !== normalize(rule.from)) {
				mismatched.push({ chore: label, current: master.description ?? '' });
				continue;
			}

			if (!dryRun) {
				await ctx.db.patch(master._id, {
					feedItems: rule.feedItems,
					description: rule.to,
					updatedAt: Date.now()
				});

				// Keep today's daily clone in sync so chips show up immediately
				if (todayDate) {
					const daily = await ctx.db
						.query('dailyChores')
						.withIndex('by_date_master', (q) =>
							q.eq('date', todayDate).eq('masterChoreId', master._id)
						)
						.first();
					if (daily) {
						await ctx.db.patch(daily._id, {
							feedItems: rule.feedItems,
							description: rule.to,
							lastModified: Date.now()
						});
					}
				}
			}
			updated.push(label);
		}

		return { dryRun, updated, mismatched, notFound, totalRules: RULES.length };
	}
});
