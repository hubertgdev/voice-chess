import './style.css'
import { GameController } from './game/GameController'

const root = document.getElementById('app')
if (!root) throw new Error('Missing #app root')

const header = document.createElement('header')
header.className = 'page-header'
const title = document.createElement('h1')
title.textContent = 'Voice Chess'
const subtitle = document.createElement('p')
subtitle.textContent = `v${__APP_VERSION__} — click or speak your moves`
header.append(title, subtitle)
root.appendChild(header)

const game = new GameController()
await game.mount(root)
