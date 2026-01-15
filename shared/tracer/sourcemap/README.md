# Tracer sourcemap

Загружает sourcemap в [tracer](https://apptracer.ru/)

```yml
- name: Upload source map to tracer
  uses: VKCOM/gh-actions/shared/tracer/sourcemap@main
  with:
    pluginToken: ${{ secrets.TRACER_PLUGIN_TOKEN }}
    path: dist
    versionName: '1.0.0'
    versionCode: 123
```
