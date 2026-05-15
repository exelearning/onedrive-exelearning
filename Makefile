EXELEARNING_EDITOR_REPO ?= exelearning/exelearning
# Optional pin: leave empty to track the latest GitHub release.
EXELEARNING_EDITOR_REF ?=
EXELEARNING_EDITOR_REF_TYPE ?= tag
EDITOR_SOURCE_DIR := exelearning
EDITOR_OUTPUT_DIR := $(CURDIR)/public/editor
EDITOR_REPO_URL := https://github.com/$(EXELEARNING_EDITOR_REPO)
EDITOR_API_LATEST := https://api.github.com/repos/$(EXELEARNING_EDITOR_REPO)/releases/latest

TMP_DIR := .cache
EDITOR_ZIP := $(TMP_DIR)/exelearning-static.zip
EDITOR_EXTRACT_DIR := $(TMP_DIR)/exelearning-static

.PHONY: download-editor fetch-editor-source build-editor clean-editor build dev lint typecheck test

# Download the prebuilt static editor from a GitHub release. Defaults to the
# latest tag; override with EXELEARNING_EDITOR_REF=vX.Y.Z if you need a pin.
download-editor:
	@mkdir -p "$(TMP_DIR)"
	@rm -rf "$(EDITOR_EXTRACT_DIR)" "$(EDITOR_ZIP)"
	@REF="$(EXELEARNING_EDITOR_REF)"; \
	if [ -z "$$REF" ]; then \
		REF=$$(curl -fsSL "$(EDITOR_API_LATEST)" | grep '"tag_name"' | head -n1 | sed -E 's/.*"tag_name": *"([^"]+)".*/\1/'); \
	fi; \
	if [ -z "$$REF" ]; then \
		echo "Could not resolve the latest eXeLearning release."; exit 1; \
	fi; \
	URL="$${EDITOR_ZIP_URL:-$(EDITOR_REPO_URL)/releases/download/$$REF/exelearning-static-$$REF.zip}"; \
	echo "Downloading eXeLearning editor $$REF from $$URL"; \
	curl -fL "$$URL" -o "$(EDITOR_ZIP)"; \
	unzip -q "$(EDITOR_ZIP)" -d "$(EDITOR_EXTRACT_DIR)"
	@rm -rf "$(EDITOR_OUTPUT_DIR)"
	@mkdir -p "$(EDITOR_OUTPUT_DIR)"
	@if [ "$$(find "$(EDITOR_EXTRACT_DIR)" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')" = "1" ] && \
		[ "$$(find "$(EDITOR_EXTRACT_DIR)" -mindepth 1 -maxdepth 1 | wc -l | tr -d ' ')" = "1" ]; then \
		cp -R "$$(find "$(EDITOR_EXTRACT_DIR)" -mindepth 1 -maxdepth 1 -type d)"/. "$(EDITOR_OUTPUT_DIR)/"; \
	else \
		cp -R "$(EDITOR_EXTRACT_DIR)"/. "$(EDITOR_OUTPUT_DIR)/"; \
	fi

# Shallow-clone the editor source. Defaults to the latest release tag; override
# with EXELEARNING_EDITOR_REF=<branch|tag|commit> + EXELEARNING_EDITOR_REF_TYPE.
fetch-editor-source:
	rm -rf "$(EDITOR_SOURCE_DIR)"
	@REF="$(EXELEARNING_EDITOR_REF)"; \
	REF_TYPE="$(EXELEARNING_EDITOR_REF_TYPE)"; \
	if [ -z "$$REF" ]; then \
		REF=$$(curl -fsSL "$(EDITOR_API_LATEST)" | grep '"tag_name"' | head -n1 | sed -E 's/.*"tag_name": *"([^"]+)".*/\1/'); \
		REF_TYPE="tag"; \
	fi; \
	if [ -z "$$REF" ]; then \
		echo "Could not resolve the latest eXeLearning release."; exit 1; \
	fi; \
	echo "Fetching eXeLearning editor source $$REF (type=$$REF_TYPE)"; \
	if [ "$$REF_TYPE" = "branch" ] || [ "$$REF_TYPE" = "tag" ]; then \
		git clone --depth 1 --branch "$$REF" "$(EDITOR_REPO_URL).git" "$(EDITOR_SOURCE_DIR)"; \
	elif [ "$$REF_TYPE" = "commit" ]; then \
		git clone --depth 1 "$(EDITOR_REPO_URL).git" "$(EDITOR_SOURCE_DIR)"; \
		cd "$(EDITOR_SOURCE_DIR)" && git checkout "$$REF"; \
	else \
		echo "EXELEARNING_EDITOR_REF_TYPE must be branch, tag, or commit"; \
		exit 1; \
	fi

build-editor:
	rm -rf "$(EDITOR_OUTPUT_DIR)"
	$(MAKE) fetch-editor-source
	cd "$(EDITOR_SOURCE_DIR)" && bun install
	cd "$(EDITOR_SOURCE_DIR)" && OUTPUT_DIR="$(EDITOR_OUTPUT_DIR)" bun run build:static

clean-editor:
	rm -rf "$(EDITOR_SOURCE_DIR)" "$(EDITOR_OUTPUT_DIR)" "$(EDITOR_ZIP)" "$(EDITOR_EXTRACT_DIR)"

build:
	npm run build

dev:
	npm run dev

lint:
	npm run lint

typecheck:
	npm run typecheck

test:
	npm test
