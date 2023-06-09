# Token Base

Экшон собирает стили фигмы и генерирует json файл с токенами

![figma styles](https://user-images.githubusercontent.com/14944123/244713050-69a6e830-b072-4638-8213-3cc1d97aa773.png)

Переводит в

```jsonc
{
  "light": {
    "text": {
      "text_primary": "#000000",
      "text_primary_invariably": "#71aaeb",
      "text_secondary": "#4986cc",
      "text_tertiary": "#4bb44b"
      // ...
    }
  }
}
```

### Использование

```yml
- name: Figma styles to json
  uses: VKCOM/gh-actions/vkui-tokens/token-base@main
  with:
    token: ${{ secrets.FIGMA_TOKEN }}
    file_key: ${{ secrets.FIGMA_FILE_KEY }}
    output_file_name: path/to/file.json
```
