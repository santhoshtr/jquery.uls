import pkg from './package.json'
import json from '@rollup/plugin-json'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import esbuild from 'rollup-plugin-esbuild'
import babel from 'rollup-plugin-babel'

export default [
  {
    input: 'src/index.js',
    output: {
      name: 'UniversalLanguageSelector',
      file: pkg.main,
      format: 'umd',
      sourcemap: 'inline'
    },
    plugins: [
      json(),
      resolve(),
      commonjs(),
      babel({
        exclude: 'node_modules/**'
      }),
      esbuild({
        sourceMap: true,
        minify: true
      })
    ]
  }
]
