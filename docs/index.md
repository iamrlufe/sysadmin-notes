---
hide:
  - toc
---

<div class="home-page" markdown>

<section class="kb-term" markdown>

<div class="kb-term__bar">
<i></i><i></i><i></i>
<span>roman@rlufe: ~/sysadmin-notes</span>
</div>

<div class="kb-term__body" markdown>

<p class="kb-cmd"><span class="kb-prompt">➜</span> <span class="kb-path">~/sysadmin-notes</span> <span class="kb-faint">$</span> cat README.md</p>

# База знаний системного администратора

<p class="kb-term__lead">Практические инструкции, команды и решения из реальной инфраструктуры: Windows Server, Linux, Docker, MikroTik, VMware, 1С, SQL Server, Exchange и мониторинг.</p>

<div class="kb-term__actions" markdown>
[./начать-читать]({{ LATEST_NOTE_URL }}){ .md-button .md-button--primary }
[ls разделы/](#sections){ .md-button }
[git clone](https://github.com/iamrlufe/sysadmin-notes){ .md-button }
</div>

<p class="kb-cmd kb-cmd--live"><span class="kb-prompt">➜</span> <span class="kb-path">~/sysadmin-notes</span> <span class="kb-faint">$</span> <span class="kb-cursor"></span></p>

</div>
</section>

<section id="sections" class="kb-sec kb-sec--dirs" markdown>

## разделы

<div class="kb-dirs">

<a class="kb-dir" href="notes/windows/">
<span class="kb-dir__perm">drwxr-xr-x</span>
<strong>windows/</strong>
<span class="kb-dir__info">DCOM, Office, 1С, службы, права доступа и рабочие инструкции для Windows Server.</span>
</a>

<a class="kb-dir" href="notes/linux/">
<span class="kb-dir__perm">drwxr-xr-x</span>
<strong>linux/</strong>
<span class="kb-dir__info">Диски, процессы, systemd, SSH, права, сеть и типовые аварийные ситуации.</span>
</a>

<a class="kb-dir" href="notes/network/">
<span class="kb-dir__perm">drwxr-xr-x</span>
<strong>network/</strong>
<span class="kb-dir__info">DNS, VPN, firewall, маршрутизация, MikroTik, Juniper и сетевые проверки.</span>
</a>

<a class="kb-dir" href="notes/monitoring/">
<span class="kb-dir__perm">drwxr-xr-x</span>
<strong>monitoring/</strong>
<span class="kb-dir__info">Zabbix, Prometheus, Grafana, алерты, метрики и диагностика инцидентов.</span>
</a>

<a class="kb-dir" href="notes/files/">
<span class="kb-dir__perm">drwxr-xr-x</span>
<strong>files/</strong>
<span class="kb-dir__info">REG-файлы, скрипты, утилиты и вспомогательные материалы к заметкам.</span>
</a>

<a class="kb-dir" href="tags/">
<span class="kb-dir__perm">lrwxrwxrwx</span>
<strong>tags/ -&gt;</strong>
<span class="kb-dir__info">Быстрый переход к заметкам по технологиям, ошибкам, сервисам и платформам.</span>
</a>

</div>
</section>

<section class="kb-sec kb-sec--log" markdown>

## последние-заметки.log

<div class="kb-log" markdown>

{{ LATEST_NOTES }}

</div>
</section>

<section class="kb-sec kb-sec--how" markdown>

## как-пополнять.txt

<div class="kb-how">
<div><b>1</b><span>Создай Markdown-файл в нужном разделе <code>docs/notes/...</code></span></div>
<div><b>2</b><span>Добавь заметку в <code>nav</code> внутри <code>mkdocs.yml</code></span></div>
<div><b>3</b><span>Сделай <code>git push</code> — Cloudflare Pages сам соберёт сайт</span></div>
</div>
</section>

</div>
