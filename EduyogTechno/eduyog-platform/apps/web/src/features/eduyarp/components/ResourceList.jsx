import { Icon } from './Icon'
import { RESOURCE_ICONS, RESOURCE_TYPE_LABELS, groupResources, hostOf } from '../utils/resources'

// Resources grouped by module. Each resource opens in a new tab with a plain link (no embedding).
// `renderActions(resource)` adds optional buttons (Trainer: edit / delete).
export function ResourceList({ resources, renderActions }) {
  return (
    <div className="res-groups">
      {groupResources(resources).map((section) => (
        <section key={section.key} className="res-group">
          <h3 className="res-group__title">{section.title}</h3>
          <ul className="res-list">
            {section.items.map((resource) => (
              <li key={resource.id} className="res">
                <span className="res__icon" aria-hidden="true">
                  <Icon name={RESOURCE_ICONS[resource.resourceType] ?? 'link'} size={20} />
                </span>
                <div className="res__main">
                  <div className="res__top">
                    <span className="res__title">{resource.title}</span>
                    <span className="badge badge--primary">{RESOURCE_TYPE_LABELS[resource.resourceType]}</span>
                  </div>
                  {resource.topicTitle && <p className="res__topic">Topic: {resource.topicTitle}</p>}
                  {resource.description && <p className="res__text">{resource.description}</p>}
                  <p className="res__host">{hostOf(resource.url)}</p>
                </div>
                <div className="res__actions">
                  <a className="btn btn--secondary btn--sm" href={resource.url} target="_blank" rel="noopener noreferrer">
                    Open resource
                    <Icon name="external" size={14} />
                    <span className="visually-hidden">: {resource.title} (opens in a new tab)</span>
                  </a>
                  {renderActions?.(resource)}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

// Questions as native expandable sections: keyboard and screen-reader friendly.
export function FaqList({ faqs }) {
  return (
    <div className="faq-list">
      {faqs.map((faq) => (
        <details key={faq.id} className="faq">
          <summary className="faq__q">
            <span>{faq.question}</span>
            <Icon name="chevronDown" size={18} className="acc__chev" />
          </summary>
          <p className="faq__a">{faq.answer}</p>
        </details>
      ))}
    </div>
  )
}
