# Transaction role-based transitions and i18n

## Goal

The transaction shown inside buyer/seller chat is a single shared state machine. The current state is shared; available actions are determined by the authenticated participant role. The UI must never let a participant arbitrarily select a next state.

## State labels

Internal state enum remains stable: `LEAD`, `VIEWING`, `OFFER`, `DEAL`, `PAYMENT`, `CONTRACT`.

Uzbek UI labels:
- LEAD: Murojaat
- VIEWING: Ko‘rish
- OFFER: Taklif
- DEAL: Bitim
- PAYMENT: To‘lov
- CONTRACT: Shartnoma

Russian UI labels:
- LEAD: Заявка
- VIEWING: Просмотр
- OFFER: Предложение
- DEAL: Сделка
- PAYMENT: Оплата
- CONTRACT: Договор

## Role policy

Buyer actions:
- LEAD: request viewing
- VIEWING: request/reschedule viewing
- OFFER: create offer
- DEAL: confirm deal
- PAYMENT: initiate payment
- CONTRACT: sign contract

Seller actions:
- LEAD: accept/reject viewing request
- VIEWING: accept/reschedule viewing
- OFFER: accept/reject/counter offer
- DEAL: confirm deal
- PAYMENT: view/confirm payment status
- CONTRACT: sign contract

The server must validate these permissions before changing transaction state. The client-side button is only a presentation of an allowed server action.
