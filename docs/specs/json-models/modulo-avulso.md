# Módulo avulso

Modelo para importar um módulo isolado com 3 aulas e avaliação, ideal para substituir ou anexar em um curso existente.

```json
{
  "title": "Módulo avulso",
  "description": "Descrição do módulo isolado.",
  "lessons": [
    {
      "title": "Aula 1 - Introdução",
      "description": "Apresenta o tema principal do módulo.",
      "lesson_type": "text",
      "text_content": "<p>Módulo avulso - aula 1.</p>",
      "blocks": [
        {
          "type": "rich-text",
          "content": "<p>Módulo avulso - aula 1.</p>"
        }
      ],
      "estimated_minutes": 8
    },
    {
      "title": "Aula 2 - Desenvolvimento",
      "description": "Aprofunda o conteúdo com um novo exemplo.",
      "lesson_type": "text",
      "text_content": "<p>Módulo avulso - aula 2.</p>",
      "blocks": [
        {
          "type": "rich-text",
          "content": "<p>Módulo avulso - aula 2.</p>"
        }
      ],
      "estimated_minutes": 10
    },
    {
      "title": "Aula 3 - Encerramento",
      "description": "Fecha o módulo com revisão prática.",
      "lesson_type": "text",
      "text_content": "<p>Módulo avulso - aula 3.</p>",
      "blocks": [
        {
          "type": "rich-text",
          "content": "<p>Módulo avulso - aula 3.</p>"
        }
      ],
      "estimated_minutes": 12
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
      "questions": [
        {
          "question_text": "Qual é o objetivo principal de o módulo avulso?",
          "question_type": "single_choice",
          "points": 1,
          "is_required": true,
          "options": [
            {
              "option_text": "Entender os conceitos básicos e a estrutura do conteúdo.",
              "is_correct": true
            },
            {
              "option_text": "Pular direto para a avaliação final.",
              "is_correct": false
            },
            {
              "option_text": "Usar apenas conteúdo visual sem texto.",
              "is_correct": false
            },
            {
              "option_text": "Ignorar a organização em módulos.",
              "is_correct": false
            }
          ]
        }
      ],
      "case_studies": []
    }
  ]
}
```
