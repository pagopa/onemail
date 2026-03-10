# Review Infrastruttura `src/infra`

Data: `2026-03-10`

## Ambito

Questa review copre solo il path `src/infra`.

Sono stati considerati:

- stack Terraform
- helper script e script operativi
- scelte IAM, networking, security e delivery
- coerenza generale dell'architettura infrastrutturale

Non sono stati valutati in questo documento:

- `src/onemail`
- comportamento runtime dell'applicazione oltre a quanto necessario per capire i contratti infrastrutturali
- `.github` se non indirettamente utile a capire la delivery dell'infra

## Executive Summary

La parte infrastrutturale del repository ha una base buona e ordinata. La decomposizione per layer è chiara, i moduli sono leggibili, la scelta dei blocchi principali AWS è sensata e si vede l'intenzione di costruire una piattaforma privata e relativamente ben governata.

Il problema non è la struttura. Il problema è la maturità operativa.

Le criticità principali sono queste:

- alcuni input di deploy sono ancora placeholder o mutabili
- l'affidabilità del path asincrono non è ancora espressa bene in infra
- i permessi IAM sono più larghi del necessario
- gli script di supporto sono disomogenei e in alcuni punti chiaramente ereditati da contesti diversi

In sintesi: `src/infra` è promettente come organizzazione, ma non ancora abbastanza rigorosa come infrastruttura di produzione.

Nota di ricalibrazione:

- sapendo che i `ref=main` sono temporanei e state già lavorando al pin con hash, considero quel punto un debito tecnico di breve periodo e non uno dei problemi strutturali principali del path `src/infra`
- restano invece pienamente validi e prioritari i rilievi su:
  - artifact placeholder del sender
  - tag immagine mutabili
  - resilienza SQS/DLQ
  - ampiezza dei permessi IAM
  - qualità e coerenza degli script operativi

## Validazioni Eseguite

- `terraform fmt -check -recursive src/infra/src`: passato
- `shellcheck -s bash src/infra/scripts/terraform.sh src/infra/scripts/terraform_run_all.sh src/infra/scripts/pre-commit.sh`: warning presenti
- ispezione statica dei principali stack:
  - `0_IAM`
  - `10_network`
  - `20_core`
  - `30_security`
  - `70_domains/onemail_common`
  - `70_domains/onemail_app`

Non eseguito:

- `terraform validate`
- `terraform plan`

Motivo:

- la review è rimasta read-only e non ha inizializzato moduli/provider remoti

## Overview Architetturale

## Come è organizzata l'infrastruttura

L'infrastruttura segue una gerarchia abbastanza pulita:

1. `0_IAM`: identità, trust e ruoli GitHub OIDC
2. `10_network`: VPC, subnet, endpoint, NLB, ALB, DNS, accelerator
3. `20_core`: elementi base condivisi, in particolare ECR
4. `30_security`: KMS, SOPS, Secrets Manager
5. `70_domains/onemail_common`: primitive di dominio condivise, in particolare DynamoDB, ECS cluster e SQS
6. `70_domains/onemail_app`: API Gateway, ECS service e Lambda sender

Questa suddivisione è buona perché separa:

- fondazioni di piattaforma
- sicurezza
- primitive comuni del dominio
- componenti applicativi veri e propri

## Punti Forti dell'Architettura Infra

- La separazione a layer è comprensibile e scalabile.
- L'uso di API Gateway privata e VPC endpoint indica un buon orientamento alla riduzione della superficie esposta.
- L'uso di SQS per separare ingestione e delivery è corretto come scelta architetturale.
- L'uso di OIDC per GitHub Actions è meglio dell'uso di credenziali statiche.
- Le versioni Terraform e provider sono in generale abbastanza esplicite.

## Punti deboli Architetturali

### 1. L'infra disegna un sistema più maturo di quello che realmente distribuisce

L'esempio più evidente è il sender Lambda.

- L'infra prevede un sender agganciato a due code SQS:
  - [`03_lambda.tf`](../src/infra/src/70_domains/onemail_app/03_lambda.tf)
- Gli environment puntano però a un package placeholder:
  - [`env/dev/eu-south-1/terraform.tfvars`](../src/infra/src/70_domains/onemail_app/env/dev/eu-south-1/terraform.tfvars)
  - [`env/uat/eu-south-1/terraform.tfvars`](../src/infra/src/70_domains/onemail_app/env/uat/eu-south-1/terraform.tfvars)
  - [`env/prod/eu-south-1/terraform.tfvars`](../src/infra/src/70_domains/onemail_app/env/prod/eu-south-1/terraform.tfvars)
- Nel repo il file realmente presente è solo:
  - [`lambda/hello-nodejs/index.js`](../src/infra/src/70_domains/onemail_app/lambda/hello-nodejs/index.js)

Questo significa che l'infrastruttura ha già la forma del sistema finale, ma il deploy effettivo non ha ancora la sostanza corretta.

### 2. Il modello di affidabilità della messaggistica è incompleto

Le code SQS esistono, ma manca ancora una policy operativa completa.

- Le queue hanno cifratura SSE gestita:
  - [`03_sqs.tf`](../src/infra/src/70_domains/onemail_common/03_sqs.tf)
- Non si vede però una strategia completa di:
  - DLQ
  - redrive policy
  - poison message handling
  - sizing e batch/error policy del sender

Per una pipeline email asincrona, questa parte non è accessoria. È il cuore dell'affidabilità operativa.

### 3. Il modello dati è troppo minimale rispetto al prodotto che sembra voler supportare

La tabella DynamoDB esiste e ha un setup di base corretto, ma l'access pattern sembra ancora immaturo.

- La configurazione della tabella non prevede GSI:
  - [`onemail_common/dev terraform.tfvars`](../src/infra/src/70_domains/onemail_common/env/dev/eu-south-1/terraform.tfvars)
  - [`onemail_common/prod terraform.tfvars`](../src/infra/src/70_domains/onemail_common/env/prod/eu-south-1/terraform.tfvars)

Se il prodotto vuole davvero supportare tracking per richiesta e query operative, l'infra oggi è troppo scarna.

## Findings

## Critical

### 1. Il deploy del sender Lambda non è ancora credibile come deploy di produzione

Rischio: `Critical`

Perché:

- la Lambda è centrale nella pipeline di delivery
- l'infra la tratta come componente reale
- il package configurato è ancora placeholder

Evidenza:

- [`03_lambda.tf`](../src/infra/src/70_domains/onemail_app/03_lambda.tf)
- [`onemail_app/prod terraform.tfvars`](../src/infra/src/70_domains/onemail_app/env/prod/eu-south-1/terraform.tfvars)
- [`lambda/hello-nodejs/index.js`](../src/infra/src/70_domains/onemail_app/lambda/hello-nodejs/index.js)

Come procedere alla fix:

1. Eliminare la dipendenza da `lambda/hello-nodejs/hello-nodejs.zip`.
2. Collegare Terraform a un artifact reale prodotto dalla build del sender.
3. Rendere esplicito in tfvars o in CI/CD il riferimento a una versione immutabile del package Lambda.
4. Aggiungere uno smoke test di deploy che verifichi che il package effettivamente distribuito non sia un placeholder.

## Major

### 1. Alcuni input di deploy sono ancora mutabili e riducono la riproducibilità

Rischio: `Major`

Evidenza:

- immagini ECS mutabili:
  - [`onemail_app/dev terraform.tfvars`](../src/infra/src/70_domains/onemail_app/env/dev/eu-south-1/terraform.tfvars)
  - [`onemail_app/uat terraform.tfvars`](../src/infra/src/70_domains/onemail_app/env/uat/eu-south-1/terraform.tfvars)
  - [`onemail_app/prod terraform.tfvars`](../src/infra/src/70_domains/onemail_app/env/prod/eu-south-1/terraform.tfvars)

Perché è un problema:

- il runtime può cambiare senza una release chiaramente tracciabile
- rollback e incident analysis diventano più deboli
- prod e uat possono divergere in modo non controllato

Come procedere alla fix:

1. Sostituire `latest` con tag di release o digest immutabili.
2. Far produrre alla CI un manifest artifact-to-version usato poi da Terraform.
3. Collegare gli stack solo ad artifact prodotti dalla pipeline, non a convenzioni manuali.
4. Considerare un controllo CI che blocchi immagini mutabili sugli stack critici.

Nota:

- il tema `ref=main` resta corretto da chiudere, ma con il tuo contesto attuale non lo considero il cuore di questo finding

### 2. IAM e permessi sono troppo larghi

Rischio: `Major`

Evidenza:

- ruolo GitHub IaC con `AdministratorAccess`:
  - [`0_IAM/01_iam_github.tf`](../src/infra/src/0_IAM/01_iam_github.tf)
- policy SES del sender con `resources = ["*"]`:
  - [`70_domains/onemail_app/03_lambda.tf`](../src/infra/src/70_domains/onemail_app/03_lambda.tf)

Perché è un problema:

- aumenta il blast radius di errori CI/CD
- contraddice il principio di least privilege che il repo dichiara come standard

Come procedere alla fix:

1. Spezzare il ruolo apply in policy più granulari per stack o per capability.
2. Limitare il sender alle permission strettamente necessarie.
3. Fare un passaggio dedicato di revisione IAM prima di considerare l'infra “production-grade”.

### 3. La resilienza della messaggistica non è ancora modellata bene

Rischio: `Major`

Evidenza:

- code SQS senza DLQ visibili:
  - [`70_domains/onemail_common/03_sqs.tf`](../src/infra/src/70_domains/onemail_common/03_sqs.tf)
- event source mapping presenti ma senza strategia completa di failure isolation:
  - [`70_domains/onemail_app/03_lambda.tf`](../src/infra/src/70_domains/onemail_app/03_lambda.tf)

Perché è un problema:

- i messaggi problematici non hanno un percorso chiaro di quarantena
- l'operatività futura rischia di basarsi solo su retry impliciti

Come procedere alla fix:

1. Aggiungere DLQ per high e low priority queue.
2. Definire redrive policy esplicita.
3. Definire max receive count coerente con il sender.
4. Aggiungere metriche e allarmi su:
   - depth queue
   - DLQ inflow
   - errori sender

### 4. Gli script infra sono disomogenei e in parte chiaramente ereditati da un altro contesto

Rischio: `Major`

Evidenza:

- `src/infra/scripts/terraform.sh` parla di Azure e usa `az account set`:
  - [`src/infra/scripts/terraform.sh`](../src/infra/scripts/terraform.sh)
- gli stack locali sotto `src/infra/src/*/terraform.sh` invece sono AWS-oriented
- `shellcheck` trova warning concreti su quoting e array handling nello script root

Perché è un problema:

- la toolchain locale non è affidabile come dovrebbe
- chi entra nel repo trova due famiglie di script con assunzioni diverse
- il rischio di eseguire il tool sbagliato o interpretare male il flusso è alto

Come procedere alla fix:

1. Decidere qual è lo script canonico.
2. Eliminare o archiviare gli helper legacy che non appartengono più a questo repo.
3. Uniformare naming, cloud target e UX degli script.
4. Portare tutti gli script al livello minimo:
   - `#!/usr/bin/env bash`
   - `set -euo pipefail`
   - quoting completo
   - help coerente
   - shellcheck pulito

### 5. Il modello dati DynamoDB è troppo povero per l'operatività futura

Rischio: `Major`

Evidenza:

- nessun `global_secondary_indexes` configurato:
  - [`onemail_common/dev terraform.tfvars`](../src/infra/src/70_domains/onemail_common/env/dev/eu-south-1/terraform.tfvars)
  - [`onemail_common/uat terraform.tfvars`](../src/infra/src/70_domains/onemail_common/env/uat/eu-south-1/terraform.tfvars)
  - [`onemail_common/prod terraform.tfvars`](../src/infra/src/70_domains/onemail_common/env/prod/eu-south-1/terraform.tfvars)

Perché è un problema:

- la tabella sembra pensata più per persistere che per essere realmente interrogata
- se il sistema dovrà supportare tracking per request o audit operativo, l'infra dovrà cambiare

Come procedere alla fix:

1. Chiarire gli access pattern previsti.
2. Se serve tracking per request, aggiungere un GSI dedicato.
3. Se serve tracking per stato o per client, disegnare ora gli indici necessari invece di rimandare.

## Minor

### 1. I `ref=main` sui moduli remoti sono ancora un debito tecnico aperto, ma sembrano transitori

Rischio: `Minor`

Ricalibrato con il nuovo contesto:

- se il pin con hash è già pianificato a brevissimo, questo non è più uno dei problemi principali del path `src/infra`
- resta comunque corretto segnalarlo finché non è effettivamente chiuso a repository state

Evidenza:

- [`10_network/11_nlb.tf`](../src/infra/src/10_network/11_nlb.tf)
- [`20_core/09_ecr.tf`](../src/infra/src/20_core/09_ecr.tf)
- [`70_domains/onemail_app/01_api_gtw.tf`](../src/infra/src/70_domains/onemail_app/01_api_gtw.tf)
- [`70_domains/onemail_app/02_ecs_service.tf`](../src/infra/src/70_domains/onemail_app/02_ecs_service.tf)
- [`70_domains/onemail_common/02_ecs_cluster.tf`](../src/infra/src/70_domains/onemail_common/02_ecs_cluster.tf)
- [`70_domains/onemail_app/99_provider.tf`](../src/infra/src/70_domains/onemail_app/99_provider.tf)
- [`70_domains/onemail_common/99_provider.tf`](../src/infra/src/70_domains/onemail_common/99_provider.tf)

Perché rimane un punto aperto:

- finché il pin non è mergiato, il comportamento dei moduli remoti resta formalmente mutabile
- il rischio però qui lo valuterei come debito di igiene infrastrutturale imminente, non come difetto architetturale profondo

Come procedere alla fix:

1. Chiudere il passaggio a hash o tag immutabili.
2. Aggiungere un check CI che impedisca nuovi `ref=main`.
3. Considerare il punto chiuso appena il pin è effettivamente in repo.

### 2. Alcune protezioni sui dati critici sono ancora troppo deboli

Rischio: `Minor`

Evidenza:

- `deletion_protection_enabled = false` anche su prod:
  - [`onemail_common/prod terraform.tfvars`](../src/infra/src/70_domains/onemail_common/env/prod/eu-south-1/terraform.tfvars)

Perché è un problema:

- su una tabella di stato, la cancellazione accidentale resta un rischio evitabile

Come procedere alla fix:

- valutare seriamente `deletion_protection_enabled = true` in prod
- valutare anche guardrail Terraform lato lifecycle se il modulo lo consente

### 3. I wrapper Terraform duplicati aumentano il costo di manutenzione

Rischio: `Minor`

Evidenza:

- esistono wrapper quasi identici in più stack:
  - `0_IAM/terraform.sh`
  - `10_network/terraform.sh`
  - `20_core/terraform.sh`
  - `30_security/terraform.sh`
  - `70_domains/onemail_common/terraform.sh`
  - `70_domains/onemail_app/terraform.sh`

Perché è un problema:

- ogni fix shell o UX va replicato più volte
- aumenta il rischio di drift operativo tra stack

Come procedere alla fix:

- valutare uno script condiviso unico o una base comune generata
- mantenere nei singoli stack solo la configurazione strettamente necessaria

## Giudizio per Categoria

## Struttura Terraform

Giudizio: `Buona`

La decomposizione è uno dei punti migliori del repo. Si capisce dove stanno IAM, network, core, security e domini applicativi. Questo è un buon punto di partenza e va preservato.

Main issues:

- presenza di input di deploy ancora mutabili, soprattutto lato immagini
- presenza di placeholder in una parte critica del dominio applicativo
- `ref=main` ancora presente, ma da leggere come debito tecnico transitorio se il pin con hash è davvero imminente

## Sicurezza

Giudizio: `Discreta ma non ancora stretta`

Ci sono buone intenzioni, soprattutto lato private networking e OIDC. Però la policy effettiva è ancora troppo larga in punti sensibili.

Main issues:

- privilegi eccessivi per apply
- policy Lambda ancora troppo aperte
- protezioni dati prod migliorabili

## Affidabilità Operativa

Giudizio: `Debole`

Questa è la parte più migliorabile dell'infra.

Main issues:

- messaggistica senza DLQ o redrive strategy esplicita
- deploy sender non ancora affidabile
- access pattern dati non ancora chiariti

## Tooling e Manutenibilità

Giudizio: `Mista`

Gli stack locali hanno una struttura ordinata, ma il tooling root è incoerente e in parte legacy.

Main issues:

- script root chiaramente non allineati al contesto AWS attuale
- duplicazione e problemi shell concreti

## Consigli Architetturali

Se dovessi migliorare l'architettura infra senza allargarla troppo, farei così:

1. Renderei immutabili tutti gli input di deploy.
2. Chiuderei il path asincrono con DLQ, artifact reali e metriche operative.
3. Ridurrei i permessi IAM prima di aggiungere nuove capability.
4. Formalizzerei l'access pattern della tabella stato con indici coerenti al prodotto.
5. Unificherei gli script Terraform per ridurre drift e confusione.

## Roadmap Pragmatica

## Fase 1

- rimuovere placeholder Lambda
- pin di artifact e chiusura del passaggio da `ref=main` a hash
- introdurre DLQ

## Fase 2

- restringere IAM
- chiarire il modello dati DynamoDB
- aggiungere `terraform validate` nel flusso di quality gate

## Fase 3

- consolidare gli script
- introdurre metriche, allarmi e smoke checks di deploy

## Valutazione Finale

`src/infra` è ben impostata come layout, ma ancora troppo permissiva e troppo incompleta nei punti che contano davvero per la messa in produzione.

Tolto il tema `ref=main`, che con il tuo contesto leggo come debito temporaneo in via di chiusura, le criticità che restano più pesanti sono:

- sender deployato con artifact placeholder
- resilienza SQS ancora incompleta
- permessi IAM troppo larghi
- input di release ancora mutabili lato immagini
- tooling operativo root non coerente

Se l'obiettivo è arrivare a una piattaforma affidabile, la priorità non è aggiungere nuovi moduli. La priorità è rendere reale, osservabile e operativamente solida la pipeline già disegnata.
