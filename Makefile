.DEFAULT_GOAL := start

.PHONY: start receiver overlay

start:
	$(MAKE) --no-print-directory -j2 receiver overlay

receiver:
	npm run receiver

overlay:
	npm run overlay
