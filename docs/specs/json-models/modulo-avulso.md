# Módulo avulso

Modelo para importar um módulo isolado e substituí-lo ou adicioná-lo em um curso existente.

```json
{
  "title": "Módulo avulso",
  "description": "Descrição do módulo isolado.",
  "lessons": [
    {
      "title": "Boas-vindas e visão geral",
      "description": "Apresenta o objetivo do módulo.",
      "lesson_type": "text",
      "text_content": "<p>Conteúdo introdutório do módulo.</p>",
      "blocks": [
        {
          "type": "rich-text",
          "content": "<p>Conteúdo introdutório do módulo.</p>"
        }
      ],
      "estimated_minutes": 8
    }
  ],
  "assessments": [
    {
      "title": "Quiz de fixação",
      "description": "Verifica a compreensão dos pontos principais.",
      "assessment_type": "module",
      "passing_score": 70,
      "max_attempts": 3,
      "estimated_minutes": 10,
      "questions": [],
      "case_studies": []
    }
  ]
}
```
