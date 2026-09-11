# Transaction role-based transitions and i18n

This document defines the next Transaction Layer contract: one shared transaction state, role-based actions, and localized UI labels. Internal state enums remain LEAD, VIEWING, OFFER, DEAL, PAYMENT, CONTRACT. Uzbek labels: Murojaat, Ko‘rish, Taklif, Bitim, To‘lov, Shartnoma. Russian labels: Заявка, Просмотр, Предложение, Сделка, Оплата, Договор.

Buyer actions: request/manage viewing, create offer, confirm deal, initiate payment, sign contract. Seller actions: accept/reject/manage viewing, accept/reject/counter offer, confirm deal, view/confirm payment status, sign contract. Server-side authorization is mandatory; UI buttons are not authorization.
