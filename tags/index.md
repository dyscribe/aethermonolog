---
layout: clean
title: Tag Index
excerpt: "An archive of posts sorted by tag."
---

{% capture site_tags %}{% for tag in site.tags %}{{ tag | first }}{% unless forloop.last %},{% endunless %}{% endfor %}{% endcapture %}
{% assign tags_list = site_tags | split:',' | sort %}

<ul class="tag-box inline">
  {% for item in (0..site.tags.size) %}{% unless forloop.last %}
    {% capture this_word %}{{ tags_list[item] | strip_newlines }}{% endcapture %}
    <li><a href="#{{ this_word }}">{{ this_word }} <span>{{ site.tags[this_word].size }}</span></a></li>
  {% endunless %}{% endfor %}
</ul>

{% for item in (0..site.tags.size) %}{% unless forloop.last %}
  {% capture this_word %}{{ tags_list[item] | strip_newlines }}{% endcapture %}
  <h2 id="{{ this_word }}">{{ this_word }}</h2>
  <ul class="post-list">
  {% for post in site.tags[this_word] %}{% if post.title != null %}
    <li><a href="{{ site.url }}{{ post.url }}">{{ post.title }}</a>
    <span id="date">
      <i class="ico-time"></i>
      {% assign m = post.date | date: "%-m" %}
      {{ post.date | date: "%-d" }}
      {% case m %}
        {% when '1' %}Januar
        {% when '2' %}Februar
        {% when '3' %}M&auml;rz
        {% when '4' %}April
        {% when '5' %}Mai
        {% when '6' %}Juni
        {% when '7' %}Juli
        {% when '8' %}August
        {% when '9' %}September
        {% when '10' %}Oktober
        {% when '11' %}November
        {% when '12' %}Dezember
      {% endcase %}
      {{ post.date | date: "%Y" }}
    </span></li>
  {% endif %}{% endfor %}
  </ul>
{% endunless %}{% endfor %}
