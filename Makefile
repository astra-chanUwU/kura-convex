.PHONY: help setup dev dev-self-hosted self-hosted-up self-hosted-down self-hosted-deploy check

help:
	@echo "setup | dev | dev-self-hosted | self-hosted-up | self-hosted-down | self-hosted-deploy | check"

setup:
	pnpm install --frozen-lockfile

dev:
	pnpm dev

dev-self-hosted:
	pnpm dev:self-hosted

self-hosted-up:
	pnpm self-hosted:up

self-hosted-down:
	pnpm self-hosted:down

self-hosted-deploy:
	pnpm self-hosted:deploy

check:
	pnpm check
