---
hide:
  - toc
---

<div class="home-page" markdown>

<section class="kb-hero" markdown>
<div class="kb-hero__content" markdown>

<span class="kb-eyebrow">RLUFE.KZ / Sysadmin Knowledge Base</span>

#  SysAdmin

## System Administrator Knowledge Base

Практические инструкции, команды и решения из реальной инфраструктуры:
Windows Server, Linux, Docker, MikroTik, VMware, 1С, SQL Server, Exchange и мониторинг.

<div class="kb-hero__actions" markdown>
[Начать читать]({{ LATEST_NOTE_URL }}){ .md-button .md-button--primary }
[Разделы](#sections){ .md-button }
[GitHub](https://github.com/iamrlufe/sysadmin-notes){ .md-button }
</div>

</div>

<div class="kb-hero__panel" markdown>
<span class="kb-panel__label">Быстрый поиск</span>

<div class="kb-search-card" markdown>
:material-magnify: **Event ID, ошибка, служба, команда**
</div>

<div class="kb-hero__chips" markdown>
`0x80070005` `DCOM` `PowerShell` `MikroTik` `DFSR` `SQL`
</div>
</div>
</section>

<section id="sections" class="kb-section" markdown>

## Разделы базы знаний

<p class="kb-section__lead">Структура под задачи системного администратора: диагностика, исправление, проверка и команды, которые можно быстро применить на сервере.</p>

<div class="kb-grid" markdown>

<a class="kb-card kb-card--windows" href="notes/windows/" markdown>
<span class="kb-card__icon">:material-microsoft-windows:</span>
<strong>Windows и ПО</strong>
<span>DCOM, Office, 1С, службы, права доступа и рабочие инструкции для Windows Server.</span>
<em>Открыть раздел</em>
</a>

<a class="kb-card kb-card--linux" href="notes/linux/" markdown>
<span class="kb-card__icon">:material-linux:</span>
<strong>Linux</strong>
<span>Диски, процессы, systemd, SSH, права, сеть и типовые аварийные ситуации.</span>
<em>Открыть раздел</em>
</a>

<a class="kb-card kb-card--network" href="notes/network/" markdown>
<span class="kb-card__icon">:material-lan-connect:</span>
<strong>Сети</strong>
<span>DNS, VPN, firewall, маршрутизация, MikroTik, Juniper и сетевые проверки.</span>
<em>Открыть раздел</em>
</a>

<a class="kb-card kb-card--monitoring" href="notes/monitoring/" markdown>
<span class="kb-card__icon">:material-monitor-dashboard:</span>
<strong>Мониторинг</strong>
<span>Zabbix, Prometheus, Grafana, алерты, метрики и диагностика инцидентов.</span>
<em>Открыть раздел</em>
</a>

<a class="kb-card kb-card--files" href="notes/files/" markdown>
<span class="kb-card__icon">:material-file-download:</span>
<strong>Файлы и утилиты</strong>
<span>REG-файлы, скрипты, утилиты и вспомогательные материалы к заметкам.</span>
<em>Открыть раздел</em>
</a>

<a class="kb-card kb-card--tags" href="tags/" markdown>
<span class="kb-card__icon">:material-tag-multiple:</span>
<strong>Теги</strong>
<span>Быстрый переход к заметкам по технологиям, ошибкам, сервисам и платформам.</span>
<em>Открыть теги</em>
</a>

</div>
</section>

<section class="kb-section kb-section--split" markdown>
<div markdown>

## Последние заметки

<div class="kb-list" markdown>

{{ LATEST_NOTES }}

</div>
</div>

<aside class="kb-side" markdown>

## Популярные темы

<div class="kb-tags" markdown>
`Windows Server` `Linux` `PowerShell` `Docker` `MikroTik` `VMware` `Exchange` `SQL Server` `1С` `Grafana` `Prometheus` `Security`
</div>

</aside>
</section>

<section class="kb-workflow" markdown>

## Как пополнять базу

<div class="kb-steps" markdown>
<div markdown>
<strong>1</strong>
<span>Создай Markdown-файл в нужном разделе `docs/notes/...`.</span>
</div>
<div markdown>
<strong>2</strong>
<span>Добавь заметку в `nav` внутри `mkdocs.yml`.</span>
</div>
<div markdown>
<strong>3</strong>
<span>Сделай `git commit` и `git push` — Cloudflare Pages сам соберет сайт.</span>
</div>
</div>
</section>

</div>
