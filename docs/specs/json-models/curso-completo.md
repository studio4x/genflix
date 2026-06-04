# Curso completo

Modelo para importar um curso inteiro, com 3 módulos, 3 aulas por módulo, quizzes e configurações globais.

```json
{
  "title": "Curso de Exemplo",
  "description": "Descrição do curso em HTML ou texto.",
  "workload_minutes": 360,
  "thumbnail_url": "https://example.com/thumb.jpg",
  "status": "draft",
  "quiz_type_settings": {
    "single_choice": true,
    "essay_ai": true,
    "drag_drop_labeling": true,
    "fill_in_the_blanks": true,
    "image_hotspot": true,
    "coloring": true,
    "case_study": true
  },
  "modules": [
    {
      "title": "Módulo 1 - Fundamentos",
      "description": "Primeiro módulo do curso com base teórica e prática.",
      "lessons": [
        {
          "title": "Fundamentos - Aula 1",
          "description": "Introduz o tema principal do módulo.",
          "lesson_type": "text",
          "text_content": "<p>Fundamentos - Aula 1: conteúdo introdutório.</p>",
          "blocks": [
            {
              "type": "rich-text",
              "content": "<p>Fundamentos - Aula 1: conteúdo introdutório.</p>"
            }
          ],
          "estimated_minutes": 8
        },
        {
          "title": "Fundamentos - Aula 2",
          "description": "Amplia a compreensão com um segundo passo.",
          "lesson_type": "text",
          "text_content": "<p>Fundamentos - Aula 2: aprofundamento do conteúdo.</p>",
          "blocks": [
            {
              "type": "rich-text",
              "content": "<p>Fundamentos - Aula 2: aprofundamento do conteúdo.</p>"
            }
          ],
          "estimated_minutes": 10
        },
        {
          "title": "Fundamentos - Aula 3",
          "description": "Fecha o ciclo com revisão prática.",
          "lesson_type": "text",
          "text_content": "<p>Fundamentos - Aula 3: revisão e aplicação.</p>",
          "blocks": [
            {
              "type": "rich-text",
              "content": "<p>Fundamentos - Aula 3: revisão e aplicação.</p>"
            }
          ],
          "estimated_minutes": 12
        }
      ],
      "assessments": [
        {
          "title": "Quiz de fixação",
          "description": "Verifica a compreensão dos pontos principais do módulo.",
          "assessment_type": "module",
          "passing_score": 70,
          "max_attempts": 3,
          "estimated_minutes": 10,
          "questions": [
            {
              "question_text": "Qual é o objetivo principal de Fundamentos?",
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
    },
    {
      "title": "Módulo 2 - Aplicação",
      "description": "Segundo módulo para aprofundamento.",
      "lessons": [
        {
          "title": "Aplicação - Aula 1",
          "description": "Introduz o tema principal do módulo.",
          "lesson_type": "text",
          "text_content": "<p>Aplicação - Aula 1: conteúdo introdutório.</p>",
          "blocks": [
            {
              "type": "rich-text",
              "content": "<p>Aplicação - Aula 1: conteúdo introdutório.</p>"
            }
          ],
          "estimated_minutes": 8
        },
        {
          "title": "Aplicação - Aula 2",
          "description": "Amplia a compreensão com um segundo passo.",
          "lesson_type": "text",
          "text_content": "<p>Aplicação - Aula 2: aprofundamento do conteúdo.</p>",
          "blocks": [
            {
              "type": "rich-text",
              "content": "<p>Aplicação - Aula 2: aprofundamento do conteúdo.</p>"
            }
          ],
          "estimated_minutes": 10
        },
        {
          "title": "Aplicação - Aula 3",
          "description": "Fecha o ciclo com revisão prática.",
          "lesson_type": "text",
          "text_content": "<p>Aplicação - Aula 3: revisão e aplicação.</p>",
          "blocks": [
            {
              "type": "rich-text",
              "content": "<p>Aplicação - Aula 3: revisão e aplicação.</p>"
            }
          ],
          "estimated_minutes": 12
        }
      ],
      "assessments": [
        {
          "title": "Quiz de fixação",
          "description": "Verifica a compreensão dos pontos principais do módulo.",
          "assessment_type": "module",
          "passing_score": 70,
          "max_attempts": 3,
          "estimated_minutes": 10,
          "questions": [
            {
              "question_text": "Qual é o objetivo principal de Aplicação?",
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
    },
    {
      "title": "Módulo 3 - Consolidação",
      "description": "Terceiro módulo com revisão e fechamento.",
      "lessons": [
        {
          "title": "Consolidação - Aula 1",
          "description": "Introduz o tema principal do módulo.",
          "lesson_type": "text",
          "text_content": "<p>Consolidação - Aula 1: conteúdo introdutório.</p>",
          "blocks": [
            {
              "type": "rich-text",
              "content": "<p>Consolidação - Aula 1: conteúdo introdutório.</p>"
            }
          ],
          "estimated_minutes": 8
        },
        {
          "title": "Consolidação - Aula 2",
          "description": "Amplia a compreensão com um segundo passo.",
          "lesson_type": "text",
          "text_content": "<p>Consolidação - Aula 2: aprofundamento do conteúdo.</p>",
          "blocks": [
            {
              "type": "rich-text",
              "content": "<p>Consolidação - Aula 2: aprofundamento do conteúdo.</p>"
            }
          ],
          "estimated_minutes": 10
        },
        {
          "title": "Consolidação - Aula 3",
          "description": "Fecha o ciclo com revisão prática.",
          "lesson_type": "text",
          "text_content": "<p>Consolidação - Aula 3: revisão e aplicação.</p>",
          "blocks": [
            {
              "type": "rich-text",
              "content": "<p>Consolidação - Aula 3: revisão e aplicação.</p>"
            }
          ],
          "estimated_minutes": 12
        }
      ],
      "assessments": [
        {
          "title": "Quiz de fixação",
          "description": "Verifica a compreensão dos pontos principais do módulo.",
          "assessment_type": "module",
          "passing_score": 70,
          "max_attempts": 3,
          "estimated_minutes": 10,
          "questions": [
            {
              "question_text": "Qual é o objetivo principal de Consolidação?",
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
  ]
}
```
