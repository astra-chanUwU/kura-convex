.PHONY: help setup dev up down deploy check

help:
	@echo "setup | dev | up | down | deploy | check"

setup:
	pnpm install --frozen-lockfile

dev:
	pnpm dev

up:
	docker compose up -d

down:
	docker compose stop

deploy:
	pnpm exec convex deploy

check:
	pnpm check
