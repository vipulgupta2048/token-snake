import {defineConfig} from 'tsup';

export default defineConfig({
	entry: {
		index: 'src/index.ts',
		cli: 'src/cli.ts',
	},
	format: ['esm'],
	outExtension: () => ({js: '.mjs'}),
	target: 'node18',
	clean: true,
	dts: {entry: 'src/index.ts'},
});
