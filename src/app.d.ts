// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		interface PageState {
			photoChoreId?: string;
			// Ordered clientIds of the photo chores in the list the modal was opened
			// from, used for left/right navigation between photos.
			photoSiblingIds?: string[];
		}
		// interface Platform {}
	}
}

export {};
